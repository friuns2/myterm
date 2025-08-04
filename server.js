const express = require('express');
const WebSocket = require('ws');
const pty = require('node-pty');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Import uuid

const app = express();
const port = 8086;

// Store active terminal sessions
const sessions = new Map(); // Map to store sessionID -> { ptyProcess, ws, timeoutId, buffer, lastSaved }
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000;
const BUFFER_SAVE_INTERVAL = 5000; // Save buffer every 5 seconds
const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB max buffer size
const SESSIONS_DIR = './sessions';

// Ensure sessions directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Buffer management functions
function saveSessionBuffer(sessionID, buffer) {
  try {
    const sessionData = {
      sessionID,
      buffer,
      timestamp: Date.now()
    };
    const filePath = path.join(SESSIONS_DIR, `${sessionID}.json`);
    fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
  } catch (error) {
    console.error(`Error saving session buffer for ${sessionID}:`, error);
  }
}

function loadSessionBuffer(sessionID) {
  try {
    const filePath = path.join(SESSIONS_DIR, `${sessionID}.json`);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const sessionData = JSON.parse(data);
      return sessionData.buffer || '';
    }
  } catch (error) {
    console.error(`Error loading session buffer for ${sessionID}:`, error);
  }
  return '';
}

function trimBuffer(buffer) {
  if (buffer.length > MAX_BUFFER_SIZE) {
    // Keep the last 80% of the buffer to maintain context
    const keepSize = Math.floor(MAX_BUFFER_SIZE * 0.8);
    return buffer.slice(-keepSize);
  }
  return buffer;
}

function deleteSessionFile(sessionID) {
  try {
    const filePath = path.join(SESSIONS_DIR, `${sessionID}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(`Error deleting session file for ${sessionID}:`, error);
  }
}

// Serve static files
app.use(express.static('public'));

const server = app.listen(port, () => {
  console.log(`Web Terminal running at http://localhost:${port}`);
});

// WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  console.log('Terminal connected');

  let sessionID = req.url.split('?sessionID=')[1];
  let ptyProcess;
  let session;

  if (sessionID && sessions.has(sessionID)) {
    // Reconnect to existing session
    session = sessions.get(sessionID);
    ptyProcess = session.ptyProcess;
    // Clear previous timeout for this session
    clearTimeout(session.timeoutId);
    // Update WebSocket instance
    session.ws = ws;
    console.log(`Reconnected to session: ${sessionID}`);

    // Send existing buffer to client for restoration
    if (session.buffer) {
      ws.send(JSON.stringify({
        type: 'restore_buffer',
        data: session.buffer
      }));
    }
  } else {
    // Check if we have a saved session on disk
    let existingBuffer = '';
    if (sessionID) {
      existingBuffer = loadSessionBuffer(sessionID);
      console.log(`Loaded buffer for session ${sessionID}: ${existingBuffer.length} characters`);
    }

    // Create new PTY process and session
    if (!sessionID) {
      sessionID = uuidv4();
    }

    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env
    });

    session = {
      ptyProcess,
      ws,
      timeoutId: null,
      buffer: existingBuffer,
      lastSaved: Date.now()
    };

    sessions.set(sessionID, session);
    console.log(`New session created: ${sessionID}`);

    // Send session ID to client
    ws.send(JSON.stringify({
      type: 'sessionID',
      sessionID: sessionID
    }));

    // Send existing buffer to client for restoration if it exists
    if (existingBuffer) {
      ws.send(JSON.stringify({
        type: 'restore_buffer',
        data: existingBuffer
      }));
    }
  }

  // Send PTY output to WebSocket and buffer it
  ptyProcess.onData((data) => {
    // Add data to session buffer
    session.buffer += data;
    session.buffer = trimBuffer(session.buffer);

    // Send to client
    ws.send(JSON.stringify({
      type: 'output',
      data: data
    }));

    // Save buffer periodically
    const now = Date.now();
    if (now - session.lastSaved > BUFFER_SAVE_INTERVAL) {
      saveSessionBuffer(sessionID, session.buffer);
      session.lastSaved = now;
    }
  });

  // Handle PTY exit
  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(`Process exited with code: ${exitCode}, signal: ${signal}`);

    // Save final buffer state
    if (session.buffer) {
      saveSessionBuffer(sessionID, session.buffer);
    }

    ws.send(JSON.stringify({
      type: 'exit',
      exitCode,
      signal
    }));

    // Clean up session on exit
    sessions.delete(sessionID);
    // Delete session file since process has ended
    deleteSessionFile(sessionID);
  });

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

        case 'clear_buffer':
          // Clear the session buffer
          if (session) {
            session.buffer = '';
            saveSessionBuffer(sessionID, session.buffer);
            console.log(`Buffer cleared for session: ${sessionID}`);
            ws.send(JSON.stringify({
              type: 'buffer_cleared',
              message: 'Buffer has been cleared'
            }));
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
    if (session) {
      // Save buffer before setting timeout
      if (session.buffer) {
        saveSessionBuffer(sessionID, session.buffer);
      }

      session.timeoutId = setTimeout(() => {
        console.log(`Session ${sessionID} timed out. Killing process.`);
        // Save final buffer state before cleanup
        if (session.buffer) {
          saveSessionBuffer(sessionID, session.buffer);
        }
        session.ptyProcess.kill();
        sessions.delete(sessionID);
        // Keep session file for potential future reconnection
      }, SESSION_TIMEOUT);
    }
  });

  // Handle WebSocket errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    const session = sessions.get(sessionID);
    if (session) {
      // Save buffer before setting timeout
      if (session.buffer) {
        saveSessionBuffer(sessionID, session.buffer);
      }

      session.timeoutId = setTimeout(() => {
        console.log(`Session ${sessionID} timed out due to error. Killing process.`);
        // Save final buffer state before cleanup
        if (session.buffer) {
          saveSessionBuffer(sessionID, session.buffer);
        }
        session.ptyProcess.kill();
        sessions.delete(sessionID);
        // Keep session file for potential future reconnection
      }, SESSION_TIMEOUT);
    }
  });
});

// Periodic buffer save for all active sessions
setInterval(() => {
  const now = Date.now();
  sessions.forEach((session, sessionID) => {
    if (session.buffer && now - session.lastSaved > BUFFER_SAVE_INTERVAL) {
      saveSessionBuffer(sessionID, session.buffer);
      session.lastSaved = now;
    }
  });
}, BUFFER_SAVE_INTERVAL);

// Cleanup old session files on startup
function cleanupOldSessions() {
  try {
    const files = fs.readdirSync(SESSIONS_DIR);
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    files.forEach(file => {
      if (file.endsWith('.json')) {
        const filePath = path.join(SESSIONS_DIR, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up old session file: ${file}`);
        }
      }
    });
  } catch (error) {
    console.error('Error cleaning up old sessions:', error);
  }
}

// Run cleanup on startup
cleanupOldSessions();