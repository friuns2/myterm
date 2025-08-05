const express = require('express');
const WebSocket = require('ws');
const SessionManager = require('./lib/sessionManager');
const WebSocketHandler = require('./lib/websocketHandler');
const ApiRoutes = require('./lib/apiRoutes');

const app = express();
const port = 3000;

// Initialize managers
const sessionManager = new SessionManager();
const wsHandler = new WebSocketHandler(sessionManager);
const apiRoutes = new ApiRoutes(sessionManager);

// Serve static files
app.use(express.static('public'));

// API routes
app.use('/api', apiRoutes.getRouter());

const server = app.listen(port, () => {
  console.log(`Web Terminal running at http://localhost:${port}`);
});

// WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  wsHandler.handleConnection(ws, req);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  sessionManager.cleanup();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  sessionManager.cleanup();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});