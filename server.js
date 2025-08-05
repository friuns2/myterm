// Main server file
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { handleWebSocketConnection, sessions } = require('./websocket/terminal-websocket');

// Import route modules
const projectsRouter = require('./routes/projects');
const worktreesRouter = require('./routes/worktrees');
const sessionsRouter = require('./routes/sessions');
const filesRouter = require('./routes/files');

// Initialize sessions router with WebSocket sessions
sessionsRouter.initializeSessions(sessions);

const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// API Routes
app.use('/api/projects', projectsRouter);
app.use('/api/projects/:projectName/worktrees', worktreesRouter);
app.use('/api/projects/:projectName/sessions', sessionsRouter);
app.use('/api/projects/:projectName', filesRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// WebSocket server
const wss = new WebSocket.Server({ 
    server,
    path: '/ws'
});

wss.on('connection', handleWebSocketConnection);

// Server startup
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

server.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
    console.log(`WebSocket server running on ws://${HOST}:${PORT}/ws`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

module.exports = { app, server };