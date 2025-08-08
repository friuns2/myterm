const express = require('express');
const { setupWebSocketServer } = require('./websocket/terminal');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { authMiddleware } = require('./middleware/auth');

const app = express();
const port = 3531;

// Serve static files
app.use(express.static('public'));

// Protect API routes if auth is configured
app.use('/api', authMiddleware);

// Import route modules
const projectsRouter = require('./routes/projects');
const sessionsRouter = require('./routes/sessions');
const filesRouter = require('./routes/files');
const worktreesRouter = require('./routes/worktrees');
const settingsRouter = require('./routes/settings');

// Use route modules
app.use('/api/projects', projectsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api', filesRouter);
app.use('/api', worktreesRouter);
app.use('/api/settings', settingsRouter);

// Move the projects-with-worktrees endpoint here to avoid routing conflicts
app.get('/api/projects-with-worktrees', require('./routes/projects').getProjectsWithWorktrees);

// Function to setup global msh alias
function setupGlobalAlias() {
    try {
        const homeDir = os.homedir();
        const zshrcPath = path.join(homeDir, '.zshrc');
        const mshPath = path.join(__dirname, 'msh.js');
        const aliasLine = `alias msh="node ${mshPath}"`;
        
        // Check if .zshrc exists
        let zshrcContent = '';
        if (fs.existsSync(zshrcPath)) {
            zshrcContent = fs.readFileSync(zshrcPath, 'utf8');
        }
        
        // Check if alias already exists and update it
        if (zshrcContent.includes('alias msh=')) {
            // Replace existing alias with new path
            const updatedContent = zshrcContent.replace(/alias msh="[^"]*"/g, aliasLine);
            fs.writeFileSync(zshrcPath, updatedContent);
            console.log('Updated msh alias in ~/.zshrc with new path');
        } else {
            // Add the alias to .zshrc
            const newContent = zshrcContent + (zshrcContent.endsWith('\n') ? '' : '\n') + aliasLine + '\n';
            fs.writeFileSync(zshrcPath, newContent);
            console.log('Added msh alias to ~/.zshrc');
        }
    } catch (error) {
        console.error('Error setting up global alias:', error.message);
    }
}

const server = app.listen(port, () => {
    console.log(`Web Terminal running at http://localhost:${port}`);
    // Setup global alias on server start
    setupGlobalAlias();
});

// Set up WebSocket server
setupWebSocketServer(server);