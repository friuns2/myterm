const express = require('express');
const WebSocket = require('ws');
const pty = require('node-pty');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { v4: uuidv4 } = require('uuid'); // Import uuid

const app = express();
const port = 3012;

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
      execSync('git init', { cwd: projectPath, stdio: 'pipe' });
      console.log(`Git repository initialized for project: ${name.trim()}`);
    } catch (gitError) {
      console.warn(`Failed to initialize git for project ${name.trim()}:`, gitError.message);
      // Continue even if git init fails
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

// API endpoint to browse directory contents
app.get('/api/browse', (req, res) => {
  const dirPath = req.query.path || process.cwd();
  
  try {
    // Security check - ensure path is within allowed directories
    const resolvedPath = path.resolve(dirPath);
    const projectsPath = path.resolve(PROJECTS_DIR);
    const homePath = path.resolve(os.homedir());
    
    if (!resolvedPath.startsWith(projectsPath) && !resolvedPath.startsWith(homePath)) {
      return res.status(403).json({ error: 'Access denied to this directory' });
    }
    
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Directory not found' });
    }
    
    const items = fs.readdirSync(resolvedPath, { withFileTypes: true })
      .map(dirent => ({
        name: dirent.name,
        type: dirent.isDirectory() ? 'directory' : 'file',
        path: path.join(resolvedPath, dirent.name)
      }))
      .sort((a, b) => {
        // Directories first, then files, both alphabetically
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    
    res.json({
      currentPath: resolvedPath,
      parentPath: path.dirname(resolvedPath),
      items
    });
  } catch (error) {
    console.error('Error browsing directory:', error);
    res.status(500).json({ error: 'Failed to browse directory' });
  }
});

// API endpoint to read file content
app.get('/api/file', (req, res) => {
  const filePath = req.query.path;
  
  if (!filePath) {
    return res.status(400).json({ error: 'File path is required' });
  }
  
  try {
    const resolvedPath = path.resolve(filePath);
    const projectsPath = path.resolve(PROJECTS_DIR);
    const homePath = path.resolve(os.homedir());
    
    if (!resolvedPath.startsWith(projectsPath) && !resolvedPath.startsWith(homePath)) {
      return res.status(403).json({ error: 'Access denied to this file' });
    }
    
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const stats = fs.statSync(resolvedPath);
    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Path is a directory, not a file' });
    }
    
    // Check if file is too large (limit to 1MB)
    if (stats.size > 1024 * 1024) {
      return res.status(413).json({ error: 'File too large to edit' });
    }
    
    const content = fs.readFileSync(resolvedPath, 'utf8');
    res.json({ content, path: resolvedPath });
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// API endpoint to save file content
app.post('/api/file', express.json(), (req, res) => {
  const { path: filePath, content } = req.body;
  
  if (!filePath) {
    return res.status(400).json({ error: 'File path is required' });
  }
  
  try {
    const resolvedPath = path.resolve(filePath);
    const projectsPath = path.resolve(PROJECTS_DIR);
    const homePath = path.resolve(os.homedir());
    
    if (!resolvedPath.startsWith(projectsPath) && !resolvedPath.startsWith(homePath)) {
      return res.status(403).json({ error: 'Access denied to this file' });
    }
    
    // Ensure directory exists
    const dirPath = path.dirname(resolvedPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    fs.writeFileSync(resolvedPath, content || '', 'utf8');
    res.json({ success: true, path: resolvedPath });
  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).json({ error: 'Failed to save file' });
  }
});

// API endpoint to create folder
app.post('/api/folder', express.json(), (req, res) => {
  const { path: folderPath } = req.body;
  
  if (!folderPath) {
    return res.status(400).json({ error: 'Folder path is required' });
  }
  
  try {
    const resolvedPath = path.resolve(folderPath);
    const projectsPath = path.resolve(PROJECTS_DIR);
    const homePath = path.resolve(os.homedir());
    
    if (!resolvedPath.startsWith(projectsPath) && !resolvedPath.startsWith(homePath)) {
      return res.status(403).json({ error: 'Access denied to this location' });
    }
    
    if (fs.existsSync(resolvedPath)) {
      return res.status(409).json({ error: 'Folder already exists' });
    }
    
    fs.mkdirSync(resolvedPath, { recursive: true });
    res.json({ success: true, path: resolvedPath });
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({ error: 'Failed to create folder' });
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
        const worktreePath = path.join(worktreesPath, dirent.name);
        let branch = 'unknown';
        try {
          branch = execSync('git branch --show-current', { cwd: worktreePath, encoding: 'utf8' }).trim();
        } catch (error) {
          console.warn(`Failed to get branch for worktree ${dirent.name}:`, error.message);
        }
        return {
          name: dirent.name,
          branch: branch,
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
  const { name, branch } = req.body;
  
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Worktree name is required' });
  }
  
  if (!branch || typeof branch !== 'string' || branch.trim() === '') {
    return res.status(400).json({ error: 'Branch name is required' });
  }
  
  const projectPath = path.join(PROJECTS_DIR, projectName);
  const worktreesPath = path.join(projectPath, 'worktrees');
  const worktreePath = path.join(worktreesPath, name.trim());
  
  try {
    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (fs.existsSync(worktreePath)) {
      return res.status(409).json({ error: 'Worktree already exists' });
    }
    
    // Create worktrees directory if it doesn't exist
    if (!fs.existsSync(worktreesPath)) {
      fs.mkdirSync(worktreesPath, { recursive: true });
    }
    
    // Create git worktree
    try {
      execSync(`git worktree add worktrees/${name.trim()} ${branch.trim()}`, { 
        cwd: projectPath, 
        stdio: 'pipe' 
      });
      console.log(`Worktree created: ${name.trim()} on branch ${branch.trim()}`);
    } catch (gitError) {
      console.error(`Failed to create worktree:`, gitError.message);
      return res.status(500).json({ error: `Failed to create worktree: ${gitError.message}` });
    }
    
    res.json({ success: true, name: name.trim(), branch: branch.trim() });
  } catch (error) {
    console.error('Error creating worktree:', error);
    res.status(500).json({ error: 'Failed to create worktree' });
  }
});

// API endpoint to merge worktree back to main
app.post('/api/projects/:projectName/worktrees/:worktreeName/merge', express.json(), (req, res) => {
  const projectName = req.params.projectName;
  const worktreeName = req.params.worktreeName;
  const { targetBranch = 'main' } = req.body;
  
  const projectPath = path.join(PROJECTS_DIR, projectName);
  const worktreePath = path.join(projectPath, 'worktrees', worktreeName);
  
  try {
    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (!fs.existsSync(worktreePath)) {
      return res.status(404).json({ error: 'Worktree not found' });
    }
    
    // Get current branch of worktree
    let currentBranch;
    try {
      currentBranch = execSync('git branch --show-current', { 
        cwd: worktreePath, 
        encoding: 'utf8' 
      }).trim();
    } catch (error) {
      return res.status(500).json({ error: 'Failed to get worktree branch' });
    }
    
    // Switch to target branch in main project
    try {
      execSync(`git checkout ${targetBranch}`, { cwd: projectPath, stdio: 'pipe' });
    } catch (error) {
      console.warn(`Failed to checkout ${targetBranch}, continuing with current branch`);
    }
    
    // Merge the worktree branch
    try {
      execSync(`git merge ${currentBranch}`, { cwd: projectPath, stdio: 'pipe' });
      console.log(`Merged branch ${currentBranch} into ${targetBranch}`);
    } catch (gitError) {
      return res.status(500).json({ error: `Failed to merge: ${gitError.message}` });
    }
    
    res.json({ 
      success: true, 
      message: `Successfully merged ${currentBranch} into ${targetBranch}` 
    });
  } catch (error) {
    console.error('Error merging worktree:', error);
    res.status(500).json({ error: 'Failed to merge worktree' });
  }
});

// API endpoint to delete a worktree
app.delete('/api/projects/:projectName/worktrees/:worktreeName', (req, res) => {
  const projectName = req.params.projectName;
  const worktreeName = req.params.worktreeName;
  
  const projectPath = path.join(PROJECTS_DIR, projectName);
  const worktreePath = path.join(projectPath, 'worktrees', worktreeName);
  
  try {
    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (!fs.existsSync(worktreePath)) {
      return res.status(404).json({ error: 'Worktree not found' });
    }
    
    // Remove git worktree
    try {
      execSync(`git worktree remove worktrees/${worktreeName}`, { 
        cwd: projectPath, 
        stdio: 'pipe' 
      });
      console.log(`Worktree removed: ${worktreeName}`);
    } catch (gitError) {
      console.error(`Failed to remove worktree:`, gitError.message);
      return res.status(500).json({ error: `Failed to remove worktree: ${gitError.message}` });
    }
    
    res.json({ success: true, message: `Worktree ${worktreeName} removed successfully` });
  } catch (error) {
    console.error('Error removing worktree:', error);
    res.status(500).json({ error: 'Failed to remove worktree' });
  }
});


const server = app.listen(port, () => {
  console.log(`Web Terminal running at http://localhost:${port}`);
});

// WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  console.log('Terminal connected');
  
  // Parse session ID and project name from query parameters
  const url = new URL(req.url, `http://${req.headers.host}`);
  let sessionID = url.searchParams.get('sessionID');
  const projectName = url.searchParams.get('projectName');
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
      const projectPath = path.join(PROJECTS_DIR, projectName);
      if (fs.existsSync(projectPath)) {
        cwd = projectPath;
      } else {
        // Create project directory if it doesn't exist
        fs.mkdirSync(projectPath, { recursive: true });
        cwd = projectPath;
      }
    }
    
    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: cwd,
      env: process.env
    });

    const session = { ptyProcess, ws, timeoutId: null, buffer: '', created: new Date().toISOString(), projectName: projectName || null };
    sessions.set(sessionID, session);
    console.log(`New session created: ${sessionID} for project: ${projectName || 'default'}`);

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