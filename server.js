const express = require('express');
const WebSocket = require('ws');
const pty = require('node-pty');
const os = require('os');
const path = require('path');
const fs = require('fs');
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
    
    // Close previous WebSocket connection if it exists and is still open
    if (session.ws && session.ws.readyState === WebSocket.OPEN) {
      session.ws.close();
    }
    
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
      if (currentSession && currentSession.ptyProcess === ptyProcess) {
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
      const currentSession = sessions.get(sessionID);
      
      // Ensure we only process messages for the correct session
      if (!currentSession || currentSession.ws !== ws) {
        console.log(`Ignoring message for invalid session: ${sessionID}`);
        return;
      }

      switch (msg.type) {
        case 'input':
          // Send input to PTY only if it belongs to this session
          if (currentSession.ptyProcess === ptyProcess) {
            ptyProcess.write(msg.data);
          }
          break;

        case 'resize':
          // Resize PTY only if it belongs to this session
          if (currentSession.ptyProcess === ptyProcess) {
            ptyProcess.resize(msg.cols, msg.rows);
          }
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
    if (session && session.ws === ws) {
      // Only set timeout if this is the current WebSocket for the session
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
    if (session && session.ws === ws) {
      // Only set timeout if this is the current WebSocket for the session
      session.timeoutId = setTimeout(() => {
        console.log(`Session ${sessionID} timed out due to error. Killing process.`);
        session.ptyProcess.kill();
        sessions.delete(sessionID);
      }, SESSION_TIMEOUT);
    }
  });
});