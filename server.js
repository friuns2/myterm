const express = require('express');
const WebSocket = require('ws');
const pty = require('node-pty');
const os = require('os');
const { v4: uuidv4 } = require('uuid'); // Import uuid

const app = express();
const port = 3000;

// Store active terminal sessions
const sessions = new Map(); // Map to store sessionID -> { ptyProcess, ws, timeoutId }
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; 

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

  if (sessionID && sessions.has(sessionID)) {
    // Reconnect to existing session
    const session = sessions.get(sessionID);
    ptyProcess = session.ptyProcess;
    // Clear previous timeout for this session
    clearTimeout(session.timeoutId);
    // Update WebSocket instance
    session.ws = ws;
    console.log(`Reconnected to session: ${sessionID}`);
  } else {
    // Create new PTY process and session
    sessionID = uuidv4();
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env
    });

    sessions.set(sessionID, { ptyProcess, ws, timeoutId: null });
    console.log(`New session created: ${sessionID}`);

    // Send session ID to client
    ws.send(JSON.stringify({
      type: 'sessionID',
      sessionID: sessionID
    }));
  }

  // Send PTY output to WebSocket
  ptyProcess.onData((data) => {
    ws.send(JSON.stringify({
      type: 'output',
      data: data
    }));
  });

  // Handle PTY exit
  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(`Process exited with code: ${exitCode}, signal: ${signal}`);
    ws.send(JSON.stringify({
      type: 'exit',
      exitCode,
      signal
    }));
    sessions.delete(sessionID); // Clean up session on exit
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