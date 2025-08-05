const express = require('express');
const WebSocket = require('ws');
const pty = require('node-pty');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { execSync, exec } = require('child_process');
const { v4: uuidv4 } = require('uuid'); // Import uuid

const app = express();
const port = 3019;

// Store active terminal sessions
const sessions = new Map(); // Map to store sessionID -> { ptyProcess, ws, timeoutId, buffer, projectName }
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000;
const MAX_BUFFER_SIZE = 0; // Maximum number of characters to buffer
const PROJECTS_DIR = path.join(__dirname, '..', 'projects'); 

// Serve static files
app.use(express.static('public'));

// Parse JSON bodies
app.use(express.json());

// API endpoint to get projects list
app.get('/api/projects', (req, res) => {
  try {
    if (!fs.existsSync(PROJECTS_DIR)) {
      fs.mkdirSync(PROJECTS_DIR, { recursive: true });
    }
    const projects = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    res.json(projects);
  } catch (error) {
    console.error('Error reading projects:', error);
    res.status(500).json({ error: 'Failed to read projects' });
  }
});

// API endpoint to delete a project
app.delete('/api/projects/:projectName', (req, res) => {
  const { projectName } = req.params;
  const projectPath = path.join(PROJECTS_DIR, projectName);
  
  try {
    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Kill any active sessions for this project
    const sessionsToKill = [];
    sessions.forEach((session, sessionID) => {
      if (session.projectName === projectName) {
        sessionsToKill.push(sessionID);
      }
    });
    
    sessionsToKill.forEach(sessionID => {
      const session = sessions.get(sessionID);
      if (session) {
        session.ptyProcess.kill();
        if (session.timeoutId) {
          clearTimeout(session.timeoutId);
        }
        sessions.delete(sessionID);
      }
    });
    
    // Remove project directory recursively
    fs.rmSync(projectPath, { recursive: true, force: true });
    
    res.json({ success: true, message: `Project '${projectName}' deleted successfully` });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project: ' + error.message });
  }
});

// API endpoint to create a new project
app.post('/api/projects', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Project name is required' });
  }
  
  const projectPath = path.join(PROJECTS_DIR, name.trim());
  try {
    if (fs.existsSync(projectPath)) {
      return res.status(409).json({ error: 'Project already exists' });
    }
    fs.mkdirSync(projectPath, { recursive: true });
    
    // Initialize git repository with initial commit
    try {
      execSync('git init', { cwd: projectPath, stdio: 'pipe' });
      // Create initial README file
      fs.writeFileSync(path.join(projectPath, 'README.md'), `# ${name.trim()}\n\nProject created on ${new Date().toISOString()}\n`);
      // Add and commit initial file
      execSync('git add README.md', { cwd: projectPath, stdio: 'pipe' });
      execSync('git commit -m "Initial commit"', { cwd: projectPath, stdio: 'pipe' });
      console.log(`Git repository initialized with initial commit for project: ${name.trim()}`);
    } catch (gitError) {
      console.warn('Failed to initialize git repository:', gitError.message);
    }
    
    res.json({ success: true, name: name.trim() });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// API endpoint to get session list for a project
app.get('/api/projects/:projectName/sessions', (req, res) => {
  const projectName = req.params.projectName;
  const sessionList = [];
  sessions.forEach((session, sessionID) => {
    if (session.projectName === projectName) {
      // Get last line from buffer for status
      const lines = session.buffer.split('\n');
      const lastLine = lines[lines.length - 1] || lines[lines.length - 2] || 'No output';
      
      sessionList.push({
        id: sessionID,
        status: lastLine.trim() || 'Active session',
        created: session.created || new Date().toISOString(),
        projectName: session.projectName
      });
    }
  });
  res.json(sessionList);
});

// API endpoint to kill a session
app.delete('/api/sessions/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  const session = sessions.get(sessionId);
  
  if (session) {
    // Kill the PTY process
    session.ptyProcess.kill();
    // Clear timeout if exists
    if (session.timeoutId) {
      clearTimeout(session.timeoutId);
    }
    // Remove from sessions map
    sessions.delete(sessionId);
    res.json({ success: true, message: 'Session killed successfully' });
  } else {
    res.status(404).json({ success: false, message: 'Session not found' });
  }
});

// API endpoint to create a worktree
app.post('/api/projects/:projectName/worktrees', (req, res) => {
  const { projectName } = req.params;
  const { branchName } = req.body;
  
  if (!branchName || typeof branchName !== 'string' || branchName.trim() === '') {
    return res.status(400).json({ error: 'Branch name is required' });
  }
  
  const projectPath = path.join(PROJECTS_DIR, projectName);
  const worktreesDir = path.join(projectPath, 'worktrees');
  const worktreePath = path.join(worktreesDir, branchName.trim());
  
  try {
    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Check if it's a git repository
    if (!fs.existsSync(path.join(projectPath, '.git'))) {
      return res.status(400).json({ error: 'Project is not a git repository' });
    }
    
    // Check if repository has any commits, if not create initial commit
    try {
      execSync('git log --oneline -1', { cwd: projectPath, stdio: 'pipe' });
    } catch (logError) {
      // No commits exist, create initial commit
      try {
        if (!fs.existsSync(path.join(projectPath, 'README.md'))) {
          fs.writeFileSync(path.join(projectPath, 'README.md'), `# ${projectName}\n\nProject created on ${new Date().toISOString()}\n`);
        }
        execSync('git add .', { cwd: projectPath, stdio: 'pipe' });
        execSync('git commit -m "Initial commit"', { cwd: projectPath, stdio: 'pipe' });
      } catch (commitError) {
        return res.status(500).json({ error: 'Failed to create initial commit: ' + commitError.message });
      }
    }
    
    // Create worktrees directory if it doesn't exist
    if (!fs.existsSync(worktreesDir)) {
      fs.mkdirSync(worktreesDir, { recursive: true });
    }
    
    if (fs.existsSync(worktreePath)) {
      return res.status(409).json({ error: 'Worktree already exists' });
    }
    
    // Create worktree
    execSync(`git worktree add worktrees/${branchName.trim()} -b ${branchName.trim()}`, { 
      cwd: projectPath, 
      stdio: 'pipe' 
    });
    
    res.json({ success: true, branchName: branchName.trim(), path: worktreePath });
  } catch (error) {
    console.error('Error creating worktree:', error);
    res.status(500).json({ error: 'Failed to create worktree: ' + error.message });
  }
});

// API endpoint to get worktrees for a project
app.get('/api/projects/:projectName/worktrees', (req, res) => {
  const { projectName } = req.params;
  const projectPath = path.join(PROJECTS_DIR, projectName);
  
  try {
    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Check if it's a git repository
    if (!fs.existsSync(path.join(projectPath, '.git'))) {
      return res.json([]);
    }
    
    // Get worktree list
    const worktreeOutput = execSync('git worktree list --porcelain', { 
      cwd: projectPath, 
      encoding: 'utf8' 
    });
    
    const worktrees = [];
    const lines = worktreeOutput.split('\n');
    let currentWorktree = {};
    
    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        if (currentWorktree.path) {
          worktrees.push(currentWorktree);
        }
        currentWorktree = { path: line.substring(9) };
      } else if (line.startsWith('branch ')) {
        currentWorktree.branch = line.substring(7);
      } else if (line === '') {
        if (currentWorktree.path) {
          worktrees.push(currentWorktree);
          currentWorktree = {};
        }
      }
    }
    
    // Filter only worktrees in the worktrees subdirectory
    const projectWorktrees = worktrees.filter(wt => 
      wt.path.includes('/worktrees/') && wt.branch
    ).map(wt => ({
      branch: wt.branch,
      path: wt.path,
      name: path.basename(wt.path)
    }));
    
    res.json(projectWorktrees);
  } catch (error) {
    console.error('Error getting worktrees:', error);
    res.status(500).json({ error: 'Failed to get worktrees: ' + error.message });
  }
});

// API endpoint to merge worktree back
app.post('/api/projects/:projectName/worktrees/:branchName/merge', (req, res) => {
  const { projectName, branchName } = req.params;
  const { targetBranch = 'main' } = req.body;
  
  const projectPath = path.join(PROJECTS_DIR, projectName);
  const worktreePath = path.join(projectPath, 'worktrees', branchName);
  
  try {
    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (!fs.existsSync(worktreePath)) {
      return res.status(404).json({ error: 'Worktree not found' });
    }
    
    // Switch to target branch and merge
    execSync(`git checkout ${targetBranch}`, { cwd: projectPath, stdio: 'pipe' });
    execSync(`git merge ${branchName}`, { cwd: projectPath, stdio: 'pipe' });
    
    // Remove worktree
    execSync(`git worktree remove worktrees/${branchName}`, { cwd: projectPath, stdio: 'pipe' });
    
    // Delete the branch
    execSync(`git branch -d ${branchName}`, { cwd: projectPath, stdio: 'pipe' });
    
    res.json({ success: true, message: `Worktree ${branchName} merged into ${targetBranch} and removed` });
  } catch (error) {
    console.error('Error merging worktree:', error);
    res.status(500).json({ error: 'Failed to merge worktree: ' + error.message });
  }
});

// API endpoint to delete worktree
app.delete('/api/projects/:projectName/worktrees/:branchName', (req, res) => {
  const { projectName, branchName } = req.params;
  const projectPath = path.join(PROJECTS_DIR, projectName);
  const worktreePath = path.join(projectPath, 'worktrees', branchName);
  
  try {
    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (!fs.existsSync(worktreePath)) {
      return res.status(404).json({ error: 'Worktree not found' });
    }
    
    // Remove worktree
    execSync(`git worktree remove worktrees/${branchName}`, { cwd: projectPath, stdio: 'pipe' });
    
    // Delete the branch
    try {
      execSync(`git branch -D ${branchName}`, { cwd: projectPath, stdio: 'pipe' });
    } catch (branchError) {
      console.warn('Could not delete branch:', branchError.message);
    }
    
    res.json({ success: true, message: `Worktree ${branchName} removed` });
   } catch (error) {
     console.error('Error removing worktree:', error);
     res.status(500).json({ error: 'Failed to remove worktree: ' + error.message });
   }
 });

// API endpoint to get sessions for a specific worktree
app.get('/api/projects/:projectName/worktrees/:branchName/sessions', (req, res) => {
  const { projectName, branchName } = req.params;
  const sessionList = [];
  
  sessions.forEach((session, sessionId) => {
    if (session.projectName === projectName && session.worktreeName === branchName) {
      sessionList.push({
        id: sessionId,
        status: session.buffer || 'Ready',
        created: session.created || new Date().toISOString(),
        projectName: session.projectName,
        worktreeName: session.worktreeName
      });
    }
  });
  res.json(sessionList);
});

const server = app.listen(port, () => {
  console.log(`Web Terminal running at http://localhost:${port}`);
});

// WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  console.log('Terminal connected');
  
  // Parse session ID, project name, and worktree name from query parameters
  const url = new URL(req.url, `http://${req.headers.host}`);
  let sessionID = url.searchParams.get('sessionID');
  const projectName = url.searchParams.get('projectName');
  const worktreeName = url.searchParams.get('worktreeName');
  let ptyProcess;

  if (sessionID && sessions.has(sessionID)) {
    // Reconnect to existing session
    const session = sessions.get(sessionID);
    ptyProcess = session.ptyProcess;
    // Clear previous timeout for this session
    clearTimeout(session.timeoutId);
    // Update WebSocket instance
    session.ws = ws;
    console.log(`Reconnected to session: ${sessionID}`);
    
    // Send buffered content to reconnecting client
    if (session.buffer && session.buffer.length > 0) {
      ws.send(JSON.stringify({
        type: 'output',
        data: session.buffer
      }));
      console.log(`Sent ${session.buffer.length} characters from buffer`);
    }
  } else {
    // Create new PTY process and session
    sessionID = uuidv4();
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    
    // Determine working directory
    let cwd = process.cwd();
    if (projectName) {
      let targetPath;
      if (worktreeName) {
        // Use worktree path if worktree is specified
        targetPath = path.join(PROJECTS_DIR, projectName, 'worktrees', worktreeName);
      } else {
        // Use main project path
        targetPath = path.join(PROJECTS_DIR, projectName);
      }
      
      if (fs.existsSync(targetPath)) {
        cwd = targetPath;
      } else if (!worktreeName) {
        // Create project directory if it doesn't exist (only for main project, not worktrees)
        fs.mkdirSync(targetPath, { recursive: true });
        cwd = targetPath;
      }
    }
    
    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: cwd,
      env: process.env
    });

    const session = { ptyProcess, ws, timeoutId: null, buffer: '', created: new Date().toISOString(), projectName: projectName || null, worktreeName: worktreeName || null };
    sessions.set(sessionID, session);
    console.log(`New session created: ${sessionID} for project: ${projectName || 'default'}${worktreeName ? ` (worktree: ${worktreeName})` : ''}`);

    // Send session ID to client
    ws.send(JSON.stringify({
      type: 'sessionID',
      sessionID: sessionID
    }));

    // Set up PTY event handlers only for new sessions
    // Send PTY output to WebSocket and buffer it
    ptyProcess.onData((data) => {
      const currentSession = sessions.get(sessionID);
      if (currentSession) {
        // Add data to buffer
        currentSession.buffer += data;
        
        // Trim buffer if it exceeds maximum size
        if (currentSession.buffer.length > MAX_BUFFER_SIZE) {
          // Keep only the last MAX_BUFFER_SIZE characters
          currentSession.buffer = currentSession.buffer.slice(-MAX_BUFFER_SIZE);
        }
        
        // Send data to connected client if WebSocket is open
        if (currentSession.ws && currentSession.ws.readyState === WebSocket.OPEN) {
          currentSession.ws.send(JSON.stringify({
            type: 'output',
            data: data
          }));
        }
      }
    });

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`Process exited with code: ${exitCode}, signal: ${signal}`);
      const currentSession = sessions.get(sessionID);
      if (currentSession && currentSession.ws && currentSession.ws.readyState === WebSocket.OPEN) {
        currentSession.ws.send(JSON.stringify({
          type: 'exit',
          exitCode,
          signal
        }));
      }
      sessions.delete(sessionID); // Clean up session on exit
    });
  }

  // Handle WebSocket messages
  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);

      switch (msg.type) {
        case 'input':
          // Send input to PTY
          ptyProcess.write(msg.data);
          break;

        case 'resize':
          // Resize PTY
          ptyProcess.resize(msg.cols, msg.rows);
          break;



        default:
          console.log('Unknown message type:', msg.type);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  // Clean up on WebSocket close
  ws.on('close', () => {
    console.log('Terminal disconnected');
    const session = sessions.get(sessionID);
    if (session) {
      session.timeoutId = setTimeout(() => {
        console.log(`Session ${sessionID} timed out. Killing process.`);
        session.ptyProcess.kill();
        sessions.delete(sessionID);
      }, SESSION_TIMEOUT);
    }
  });

  // Handle WebSocket errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    const session = sessions.get(sessionID);
    if (session) {
      session.timeoutId = setTimeout(() => {
        console.log(`Session ${sessionID} timed out due to error. Killing process.`);
        session.ptyProcess.kill();
        sessions.delete(sessionID);
      }, SESSION_TIMEOUT);
    }
  });
});