const express = require('express');
const WebSocket = require('ws');
const pty = require('node-pty');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid'); // Import uuid
const { execSync, spawn } = require('child_process');

const app = express();
const port = 3019;

// Store active terminal sessions
const sessions = new Map(); // Map to store sessionID -> { ptyProcess, ws, timeoutId, buffer, projectName }
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000;
const MAX_BUFFER_SIZE = 0; // Maximum number of characters to buffer
const PROJECTS_DIR = path.join(__dirname, '..', 'projects'); 

// Serve static files
app.use(express.static('public'));

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

// API endpoint to create a new project
app.post('/api/projects', express.json(), (req, res) => {
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
    
    // Initialize git repository
    try {
      execSync('git init', { cwd: projectPath, stdio: 'ignore' });
      console.log(`Git repository initialized for project: ${name.trim()}`);
    } catch (gitError) {
      console.warn(`Failed to initialize git for project ${name.trim()}:`, gitError.message);
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

// API endpoint to get worktrees for a project
app.get('/api/projects/:projectName/worktrees', (req, res) => {
  const projectName = req.params.projectName;
  const projectPath = path.join(PROJECTS_DIR, projectName);
  const worktreesPath = path.join(projectPath, 'worktrees');
  
  try {
    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (!fs.existsSync(worktreesPath)) {
      return res.json([]);
    }
    
    const worktrees = fs.readdirSync(worktreesPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => {
        const worktreeName = dirent.name;
        const worktreePath = path.join(worktreesPath, worktreeName);
        let branchName = 'unknown';
        let status = 'unknown';
        
        try {
          // Get current branch
          branchName = execSync('git branch --show-current', { cwd: worktreePath, encoding: 'utf8' }).trim();
          // Get status
          const gitStatus = execSync('git status --porcelain', { cwd: worktreePath, encoding: 'utf8' }).trim();
          status = gitStatus ? 'modified' : 'clean';
        } catch (error) {
          console.warn(`Failed to get git info for worktree ${worktreeName}:`, error.message);
        }
        
        return {
          name: worktreeName,
          branch: branchName,
          status: status,
          path: worktreePath
        };
      });
    
    res.json(worktrees);
  } catch (error) {
    console.error('Error reading worktrees:', error);
    res.status(500).json({ error: 'Failed to read worktrees' });
  }
});

// API endpoint to create a new worktree
app.post('/api/projects/:projectName/worktrees', express.json(), (req, res) => {
  const projectName = req.params.projectName;
  const { branchName } = req.body;
  
  if (!branchName || typeof branchName !== 'string' || branchName.trim() === '') {
    return res.status(400).json({ error: 'Branch name is required' });
  }
  
  const projectPath = path.join(PROJECTS_DIR, projectName);
  const worktreesPath = path.join(projectPath, 'worktrees');
  const worktreeName = `${branchName.trim()}-w1`;
  const worktreePath = path.join(worktreesPath, worktreeName);
  
  try {
    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Create worktrees directory if it doesn't exist
    if (!fs.existsSync(worktreesPath)) {
      fs.mkdirSync(worktreesPath, { recursive: true });
    }
    
    if (fs.existsSync(worktreePath)) {
      return res.status(409).json({ error: 'Worktree already exists' });
    }
    
    // Create and checkout new branch, then create worktree
    try {
      // Check if branch exists
      let branchExists = false;
      try {
        execSync(`git show-ref --verify --quiet refs/heads/${branchName.trim()}`, { cwd: projectPath, stdio: 'ignore' });
        branchExists = true;
      } catch (e) {
        // Branch doesn't exist
      }
      
      if (!branchExists) {
        // Create new branch
        execSync(`git checkout -b ${branchName.trim()}`, { cwd: projectPath, stdio: 'ignore' });
        execSync('git checkout main || git checkout master', { cwd: projectPath, stdio: 'ignore' });
      }
      
      // Create worktree
      execSync(`git worktree add ${worktreePath} ${branchName.trim()}`, { cwd: projectPath, stdio: 'ignore' });
      
      res.json({ success: true, name: worktreeName, branch: branchName.trim(), path: worktreePath });
    } catch (gitError) {
      console.error('Git worktree creation failed:', gitError.message);
      res.status(500).json({ error: 'Failed to create git worktree: ' + gitError.message });
    }
  } catch (error) {
    console.error('Error creating worktree:', error);
    res.status(500).json({ error: 'Failed to create worktree' });
  }
});

// API endpoint to merge worktree back to main
app.post('/api/projects/:projectName/worktrees/:worktreeName/merge', express.json(), (req, res) => {
  const projectName = req.params.projectName;
  const worktreeName = req.params.worktreeName;
  
  const projectPath = path.join(PROJECTS_DIR, projectName);
  const worktreesPath = path.join(projectPath, 'worktrees');
  const worktreePath = path.join(worktreesPath, worktreeName);
  
  try {
    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (!fs.existsSync(worktreePath)) {
      return res.status(404).json({ error: 'Worktree not found' });
    }
    
    // Get the branch name from the worktree
    let branchName;
    try {
      branchName = execSync('git branch --show-current', { cwd: worktreePath, encoding: 'utf8' }).trim();
    } catch (error) {
      return res.status(500).json({ error: 'Failed to get branch name from worktree' });
    }
    
    try {
      // Switch to main/master branch in main project
      try {
        execSync('git checkout main', { cwd: projectPath, stdio: 'ignore' });
      } catch (e) {
        execSync('git checkout master', { cwd: projectPath, stdio: 'ignore' });
      }
      
      // Merge the branch
      execSync(`git merge ${branchName}`, { cwd: projectPath, stdio: 'ignore' });
      
      // Remove the worktree
      execSync(`git worktree remove ${worktreePath}`, { cwd: projectPath, stdio: 'ignore' });
      
      // Delete the branch
      execSync(`git branch -d ${branchName}`, { cwd: projectPath, stdio: 'ignore' });
      
      res.json({ success: true, message: 'Worktree merged and removed successfully' });
    } catch (gitError) {
      console.error('Git merge failed:', gitError.message);
      res.status(500).json({ error: 'Failed to merge worktree: ' + gitError.message });
    }
  } catch (error) {
    console.error('Error merging worktree:', error);
    res.status(500).json({ error: 'Failed to merge worktree' });
  }
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
        // Use worktree path
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
      } else {
        // Worktree doesn't exist, fall back to main project
        const projectPath = path.join(PROJECTS_DIR, projectName);
        if (fs.existsSync(projectPath)) {
          cwd = projectPath;
        }
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
    console.log(`Working directory: ${cwd}`);

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