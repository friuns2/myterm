const express = require('express');
const { setupWebSocketServer } = require('./websocket/terminal');

const app = express();
const port = 3551;

// Serve static files
app.use(express.static('public'));

// Import route modules
const projectsRouter = require('./routes/projects');
const sessionsRouter = require('./routes/sessions');
const filesRouter = require('./routes/files');
const worktreesRouter = require('./routes/worktrees');
const environmentRouter = require('./routes/environment');

// Use route modules
app.use('/api/projects', projectsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api', filesRouter);
app.use('/api', worktreesRouter);
app.use('/api/environment', environmentRouter);

// Move the projects-with-worktrees endpoint here to avoid routing conflicts
app.get('/api/projects-with-worktrees', require('./routes/projects').getProjectsWithWorktrees);

const server = app.listen(port, () => {
    console.log(`Web Terminal running at http://localhost:${port}`);
});

// Set up WebSocket server
setupWebSocketServer(server);