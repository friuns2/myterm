const { v4: uuidv4 } = require('uuid');
const pty = require('node-pty');
const os = require('os');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const config = require('./config');

class SessionManager {
  constructor() {
    this.sessions = new Map(); // Map to store sessionID -> { ptyProcess, ws, timeoutId, buffer, projectName }
  }

  createSession(projectName = null) {
    const sessionID = uuidv4();
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    
    // Determine working directory
    let cwd = process.cwd();
    if (projectName) {
      const projectPath = path.join(config.PROJECTS_DIR, projectName);
      if (fs.existsSync(projectPath)) {
        cwd = projectPath;
      } else {
        // Create project directory if it doesn't exist
        fs.mkdirSync(projectPath, { recursive: true });
        cwd = projectPath;
      }
    }
    
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: config.WEBSOCKET_CONFIG.cols,
      rows: config.WEBSOCKET_CONFIG.rows,
      cwd: cwd,
      env: process.env
    });

    const session = {
      ptyProcess,
      ws: null,
      timeoutId: null,
      buffer: '',
      created: new Date().toISOString(),
      projectName: projectName || null
    };
    
    this.sessions.set(sessionID, session);
    console.log(`New session created: ${sessionID} for project: ${projectName || 'default'}`);
    
    return { sessionID, session };
  }

  getSession(sessionID) {
    return this.sessions.get(sessionID);
  }

  hasSession(sessionID) {
    return this.sessions.has(sessionID);
  }

  deleteSession(sessionID) {
    const session = this.sessions.get(sessionID);
    if (session) {
      if (session.timeoutId) {
        clearTimeout(session.timeoutId);
      }
      if (session.ptyProcess) {
        session.ptyProcess.kill();
      }
      this.sessions.delete(sessionID);
      console.log(`Session ${sessionID} deleted`);
      return true;
    }
    return false;
  }

  reconnectSession(sessionID, ws) {
    const session = this.sessions.get(sessionID);
    if (session) {
      // Clear previous timeout for this session
      if (session.timeoutId) {
        clearTimeout(session.timeoutId);
        session.timeoutId = null;
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
      return true;
    }
    return false;
  }

  setSessionTimeout(sessionID) {
    const session = this.sessions.get(sessionID);
    if (session) {
      session.timeoutId = setTimeout(() => {
        console.log(`Session ${sessionID} timed out. Killing process.`);
        this.deleteSession(sessionID);
      }, config.SESSION_TIMEOUT);
    }
  }

  getAllSessions() {
    const sessionList = [];
    for (const [sessionID, session] of this.sessions) {
      sessionList.push({
        sessionID,
        created: session.created,
        projectName: session.projectName,
        active: session.ws && session.ws.readyState === WebSocket.OPEN
      });
    }
    return sessionList;
  }

  getSessionsByProject(projectName) {
    const projectSessions = [];
    for (const [sessionID, session] of this.sessions) {
      if (session.projectName === projectName) {
        projectSessions.push({
          sessionID,
          created: session.created,
          active: session.ws && session.ws.readyState === WebSocket.OPEN
        });
      }
    }
    return projectSessions;
  }

  setupPtyHandlers(sessionID) {
    const session = this.sessions.get(sessionID);
    if (!session) return;

    const { ptyProcess } = session;

    // Send PTY output to WebSocket and buffer it
    ptyProcess.onData((data) => {
      const currentSession = this.sessions.get(sessionID);
      if (currentSession) {
        // Add data to buffer
        currentSession.buffer += data;
        
        // Trim buffer if it exceeds maximum size
        if (config.MAX_BUFFER_SIZE > 0 && currentSession.buffer.length > config.MAX_BUFFER_SIZE) {
          // Keep only the last MAX_BUFFER_SIZE characters
          currentSession.buffer = currentSession.buffer.slice(-config.MAX_BUFFER_SIZE);
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
      const currentSession = this.sessions.get(sessionID);
      if (currentSession && currentSession.ws && currentSession.ws.readyState === WebSocket.OPEN) {
        currentSession.ws.send(JSON.stringify({
          type: 'exit',
          exitCode,
          signal
        }));
      }
      this.sessions.delete(sessionID); // Clean up session on exit
    });
  }
}

module.exports = new SessionManager();