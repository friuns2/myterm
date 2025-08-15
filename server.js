const express = require('express');
const { setupWebSocketServer } = require('./websocket/terminal');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { basicAuthMiddleware, rejectUpgradeIfUnauthorized } = require('./middleware/basicAuth');

const app = express();

// Generate port based on directory execution hash
function generatePortFromDirectory() {
    const currentDir = process.cwd();
    const hash = crypto.createHash('sha256').update(currentDir).digest('hex');
    // Convert first 8 characters of hash to integer and map to range 3000-4000
    const hashInt = parseInt(hash.substring(0, 8), 16);
    const basePort = 3000 + (hashInt % 1001); // 1001 gives us range 3000-4000
    return basePort;
}

// Check if port is available
function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = require('net').createServer();
        server.listen(port, () => {
            server.once('close', () => resolve(true));
            server.close();
        });
        server.on('error', () => resolve(false));
    });
}

// Find available port starting from the generated one
async function findAvailablePort() {
    let port = generatePortFromDirectory();
    const maxPort = 4000;
    
    while (port <= maxPort) {
        if (await isPortAvailable(port)) {
            return port;
        }
        port++;
    }
    
    // If no port found in range, wrap around to 3000
    for (let p = 3000; p < generatePortFromDirectory(); p++) {
        if (await isPortAvailable(p)) {
            return p;
        }
    }
    
    throw new Error('No available ports in range 3000-4000');
}

let port;

// Serve static files
app.use(basicAuthMiddleware);
app.use(express.static('public'));

// Import route modules
const projectsRouter = require('./routes/projects');
const sessionsRouter = require('./routes/sessions');
const filesRouter = require('./routes/files');
const worktreesRouter = require('./routes/worktrees');
const settingsRouter = require('./routes/settings');
const predictionsRouter = require('./routes/predictions');

// Use route modules
app.use('/api/projects', projectsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api', filesRouter);
app.use('/api', worktreesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/predictions', predictionsRouter);

// Move the projects-with-worktrees endpoint here to avoid routing conflicts
app.get('/api/projects-with-worktrees', require('./routes/projects').getProjectsWithWorktrees);

const ZSHRC_PATH = path.join(os.homedir(), '.zshrc');


// Ensure ~/.zshrc sources local settings file under this project
function ensureLocalSettingsIncluded() {
    try {
        const settingsFilePath = path.join(__dirname, 'settings', 'settings.zsh');
        let zshrcContent = fs.existsSync(ZSHRC_PATH) ? fs.readFileSync(ZSHRC_PATH, 'utf8') : '';
        const includeLine = `[ -f "${settingsFilePath}" ] && source "${settingsFilePath}"`;
        if (!zshrcContent.includes(settingsFilePath)) {
            const newContent = zshrcContent + (zshrcContent.endsWith('\n') ? '' : '\n') + includeLine + '\n';
            fs.writeFileSync(ZSHRC_PATH, newContent);
        }
    } catch (error) {
        console.error('Error ensuring local settings include in ~/.zshrc:', error.message);
    }
}

// Initialize server with dynamic port
async function startServer() {
    try {
        port = await findAvailablePort();
        console.log(`Generated port ${generatePortFromDirectory()} for directory: ${process.cwd()}`);
        console.log(`Using available port: ${port}`);
        
        const server = app.listen(port, () => {
            console.log(`Web Terminal running at http://localhost:${port}`);
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
        
    } catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
}

// Start the server
startServer();

// Global safety nets to avoid crashing the whole process
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});