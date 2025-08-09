const express = require('express');
const { setupWebSocketServer } = require('./websocket/terminal');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { basicAuthMiddleware, rejectUpgradeIfUnauthorized } = require('./middleware/basicAuth');

const app = express();
const port = 3531;

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

const ZSHRC_PATH = path.join(os.homedir(), '.zshrc');

// Function to setup global msh alias
function setupGlobalAlias() {
    try {
        const mshPath = path.join(__dirname, 'msh.js');
        const aliasLine = `alias msh="node ${mshPath}"`;
        
        // Check if .zshrc exists
        let zshrcContent = '';
        if (fs.existsSync(ZSHRC_PATH)) {
            zshrcContent = fs.readFileSync(ZSHRC_PATH, 'utf8');
        }
        
        // Check if alias already exists and update it
        if (zshrcContent.includes('alias msh=')) {
            // Replace existing alias with new path
            const updatedContent = zshrcContent.replace(/alias msh="[^"]*"/g, aliasLine);
            fs.writeFileSync(ZSHRC_PATH, updatedContent);
            console.log('Updated msh alias in ~/.zshrc with new path');
        } else {
            // Add the alias to .zshrc
            const newContent = zshrcContent + (zshrcContent.endsWith('\n') ? '' : '\n') + aliasLine + '\n';
            fs.writeFileSync(ZSHRC_PATH, newContent);
            console.log('Added msh alias to ~/.zshrc');
        }
    } catch (error) {
        console.error('Error setting up global alias:', error.message);
    }
}

// Ensure ~/.zshrc sources local settings file under this project
function ensureLocalSettingsIncluded() {
    try {
        const settingsFilePath = path.join(__dirname, 'settings', 'aliases.zsh');

        let zshrcContent = '';
        if (fs.existsSync(ZSHRC_PATH)) {
            zshrcContent = fs.readFileSync(ZSHRC_PATH, 'utf8');
        }

        // Migration: remove any old tagged block if present
        zshrcContent = zshrcContent.replace(/# === MyShell24 Settings Start ===[\s\S]*?# === MyShell24 Settings End ===\n?/g, '');

        // Ensure a single include exists; avoid duplicates
        const escapedPath = settingsFilePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const includeRegex = new RegExp(`^\\s*(source|\\.)\\s+"?${escapedPath}"?\\s*$`, 'm');
        if (!includeRegex.test(zshrcContent)) {
            const includeSnippet = [
                '# Load MyShell24 settings',
                `if [ -f "${settingsFilePath}" ]; then`,
                `  source "${settingsFilePath}"`,
                'fi'
            ].join('\n');
            const newContent = zshrcContent + (zshrcContent.endsWith('\n') ? '' : '\n') + '\n' + includeSnippet + '\n';
            fs.writeFileSync(ZSHRC_PATH, newContent);
            console.log('Added MyShell24 settings include to ~/.zshrc');
        }
    } catch (error) {
        console.error('Error ensuring local settings include in ~/.zshrc:', error.message);
    }
}

const server = app.listen(port, () => {
    console.log(`Web Terminal running at http://localhost:${port}`);
    // Setup global alias on server start
    setupGlobalAlias();
    // Ensure ~/.zshrc includes local settings file
    ensureLocalSettingsIncluded();
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