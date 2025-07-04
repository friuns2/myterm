const express = require('express');
const WebSocket = require('ws');
const pty = require('node-pty');
const os = require('os');

const app = express();
const port = 3000;

// Serve static files
app.use(express.static('public'));

const server = app.listen(port, () => {
  console.log(`Web Terminal running at http://localhost:${port}`);
});

// WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Terminal connected');
  
  // Create PTY process
  const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: process.cwd(),
    env: process.env
  });

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
    ptyProcess.kill();
  });

  // Handle WebSocket errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    ptyProcess.kill();
  });
});