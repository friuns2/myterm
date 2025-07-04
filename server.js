const express = require('express');
const WebSocket = require('ws');
const { exec } = require('child_process');
const path = require('path');

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
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'output',
    data: 'Web Terminal v1.0 - Type commands and press Enter\n$ '
  }));

  ws.on('message', (message) => {
    const { command } = JSON.parse(message);
    
    if (command.trim() === 'clear') {
      ws.send(JSON.stringify({ type: 'clear' }));
      return;
    }

    exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
      let output = '';
      
      if (stdout) output += stdout;
      if (stderr) output += stderr;
      if (error && !stderr) output += `Error: ${error.message}`;
      
      ws.send(JSON.stringify({
        type: 'output',
        data: output + '\n$ '
      }));
    });
  });

  ws.on('close', () => {
    console.log('Terminal disconnected');
  });
}); 