const express = require('express');
const { setupWebSocketServer } = require('./websocket/terminal');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { basicAuthMiddleware, rejectUpgradeIfUnauthorized } = require('./middleware/basicAuth');

const app = express();
const port = 3531;

// Configure ZDOTDIR so all zsh terminals load from ./settings/.zshrc
// Resolve absolute path once at server start
const SETTINGS_DIR = path.resolve(__dirname, 'settings');
try {
    fs.mkdirSync(SETTINGS_DIR, { recursive: true });
} catch (e) {
    console.error('Failed to create settings directory:', e);
}
const SETTINGS_ZSHRC = path.join(SETTINGS_DIR, '.zshrc');
if (!fs.existsSync(SETTINGS_ZSHRC)) {
    try {
        const defaultContent = `# Managed by MyShell24\n${'# === MyShell24 Aliases Start ==='}\n${'# === MyShell24 Aliases End ==='}\n`;
        fs.writeFileSync(SETTINGS_ZSHRC, defaultContent);
    } catch (e) {
        console.error('Failed to initialize settings .zshrc:', e);
    }
}
process.env.ZDOTDIR = SETTINGS_DIR;
console.log('ZDOTDIR set to', process.env.ZDOTDIR);

// Serve static files
app.use(basicAuthMiddleware);
app.use(express.static('public'));

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

// Enforce Basic Auth on WebSocket upgrades
server.on('upgrade', (req, socket) => {
    if (rejectUpgradeIfUnauthorized(req, socket)) {
        return;
    }
    // If authorized, do nothing; ws server will handle the upgrade
});

// Set up WebSocket server
setupWebSocketServer(server);