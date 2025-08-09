#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { PROJECTS_DIR } = require('./middleware/security');

// Parse command line arguments
const args = process.argv.slice(2);

function showHelp() {
    console.log('MSH - MyShell Project Manager');
    console.log('Usage:');
    console.log('  node msh.js -p <path>                 Add a project folder');
    console.log('  node msh.js --help       Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node msh.js -p ./        Add current directory as project');
    console.log('  node msh.js -p /path/to/project  Add specific path as project');
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


// If we reach here, unknown command
console.error('Error: Unknown command or missing arguments');
showHelp();
process.exit(1);