const express = require('express');
const config = require('./src/config');
const routes = require('./src/routes');
const WebSocketHandler = require('./src/websocketHandler');

const app = express();

// Serve static files
app.use(express.static('public'));

// Use API routes
app.use('/api', routes);

// Start server
const server = app.listen(config.PORT, () => {
  console.log(`Web Terminal running at http://localhost:${config.PORT}`);
});

// Initialize WebSocket handler
new WebSocketHandler(server);