#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { PROJECTS_DIR } = require('./middleware/security');
const http = require('http');

// Parse command line arguments
const args = process.argv.slice(2);

function showHelp() {
    console.log('MSH - MyShell Project Manager');
    console.log('Usage:');
    console.log('  node msh.js -p <path>                 Add a project folder');
    console.log('  node msh.js -s <project> <command>    Create session for project and run command (HTTP)');
    console.log('  node msh.js --help       Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node msh.js -p ./        Add current directory as project');
    console.log('  node msh.js -p /path/to/project  Add specific path as project');
    console.log('  node msh.js -s myproj "npm install"');
}

function addProject(projectPath) {
    try {
        // Resolve the absolute path
        const absolutePath = path.resolve(projectPath);
        
        // Check if the path exists
        if (!fs.existsSync(absolutePath)) {
            console.error(`Error: Path does not exist: ${absolutePath}`);
            process.exit(1);
        }
        
        // Check if it's a directory
        const stats = fs.statSync(absolutePath);
        if (!stats.isDirectory()) {
            console.error(`Error: Path is not a directory: ${absolutePath}`);
            process.exit(1);
        }
        
        // Get the project name from the directory name
        const projectName = path.basename(absolutePath);
        const targetPath = path.join(PROJECTS_DIR, projectName);
        
        // Check if project already exists
        if (fs.existsSync(targetPath)) {
            console.log(`Project '${projectName}' already exists in projects directory.`);
            return;
        }
        
        // Create projects directory if it doesn't exist
        if (!fs.existsSync(PROJECTS_DIR)) {
            fs.mkdirSync(PROJECTS_DIR, { recursive: true });
        }
        
        // Create symbolic link or copy the project
        if (absolutePath !== targetPath) {
            try {
                // Try to create a symbolic link first
                fs.symlinkSync(absolutePath, targetPath, 'dir');
                console.log(`Successfully added project '${projectName}' as symbolic link.`);
            } catch (symlinkError) {
                // If symbolic link fails, inform user
                console.error(`Could not create symbolic link: ${symlinkError.message}`);
                console.log(`You may need to manually copy the project to: ${targetPath}`);
            }
        } else {
            console.log(`Project '${projectName}' is already in the projects directory.`);
        }
        
    } catch (error) {
        console.error(`Error adding project: ${error.message}`);
        process.exit(1);
    }
}

// Main command processing
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
}

// Process -p flag
const pIndex = args.indexOf('-p');
if (pIndex !== -1) {
    if (pIndex + 1 >= args.length) {
        console.error('Error: -p flag requires a path argument');
        showHelp();
        process.exit(1);
    }
    
    const projectPath = args[pIndex + 1];
    addProject(projectPath);
    process.exit(0);
}

// Process -s flag
const sIndex = args.indexOf('-s');
if (sIndex !== -1) {
    if (sIndex + 1 >= args.length) {
        console.error('Error: -s flag requires a project name and a command');
        showHelp();
        process.exit(1);
    }

    const projectName = args[sIndex + 1];
    const commandParts = args.slice(sIndex + 2);
    if (commandParts.length === 0) {
        console.error('Error: Missing command to run. Usage: -s <project> <command>');
        showHelp();
        process.exit(1);
    }
    const commandLine = commandParts.join(' ');

    // Basic Auth credentials must match the server's settings
    const USERNAME = 'friuns';
    const PASSWORD = 'er54s4';
    const authHeader = 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

    const postData = JSON.stringify({ projectName, command: commandLine });
    const options = {
        hostname: 'localhost',
        port: 3531,
        path: '/api/sessions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'Authorization': authHeader
        }
    };

    const req = http.request(options, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
            try {
                const data = JSON.parse(body || '{}');
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    if (data.sessionID) {
                        console.log(`Session created: ${data.sessionID} (project: ${projectName})`);
                    }
                    if (data.output) {
                        process.stdout.write(data.output);
                    }
                    process.exit(0);
                } else {
                    console.error('Request failed:', data.error || body || `HTTP ${res.statusCode}`);
                    process.exit(1);
                }
            } catch (e) {
                console.error('Invalid response from server:', e.message || String(e));
                process.exit(1);
            }
        });
    });

    req.on('error', (e) => {
        console.error(`Request error: ${e.message}`);
        process.exit(1);
    });

    req.write(postData);
    req.end();
    
    // Do not fall through to the unknown command handler
    return;
} else {
    console.error('Error: Unknown command or missing arguments');
    showHelp();
    process.exit(1);
}