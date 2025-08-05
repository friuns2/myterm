// Project management routes
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const router = express.Router();

// Base directory for projects
const PROJECTS_DIR = process.env.PROJECTS_DIR || path.join(process.cwd(), 'projects');

// Ensure projects directory exists
fs.mkdir(PROJECTS_DIR, { recursive: true }).catch(console.error);

// Helper function to check if path is safe
function isSafePath(requestedPath) {
    const resolvedPath = path.resolve(PROJECTS_DIR, requestedPath);
    return resolvedPath.startsWith(path.resolve(PROJECTS_DIR));
}

// Get all projects
router.get('/', async (req, res) => {
    try {
        const projects = await fs.readdir(PROJECTS_DIR);
        const projectList = [];
        
        for (const project of projects) {
            const projectPath = path.join(PROJECTS_DIR, project);
            const stat = await fs.stat(projectPath);
            if (stat.isDirectory()) {
                projectList.push(project);
            }
        }
        
        res.json(projectList);
    } catch (error) {
        console.error('Error listing projects:', error);
        res.status(500).json({ error: 'Failed to list projects' });
    }
});

// Create a new project
router.post('/', async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name || typeof name !== 'string') {
            return res.status(400).json({ error: 'Project name is required' });
        }
        
        // Sanitize project name
        const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '');
        if (!sanitizedName) {
            return res.status(400).json({ error: 'Invalid project name' });
        }
        
        const projectPath = path.join(PROJECTS_DIR, sanitizedName);
        
        // Check if project already exists
        try {
            await fs.access(projectPath);
            return res.status(409).json({ error: 'Project already exists' });
        } catch {
            // Project doesn't exist, continue
        }
        
        // Create project directory
        await fs.mkdir(projectPath, { recursive: true });
        
        // Initialize git repository
        try {
            execSync('git init', { cwd: projectPath, stdio: 'ignore' });
            
            // Create initial README
            const readmeContent = `# ${sanitizedName}\n\nProject created on ${new Date().toISOString()}\n`;
            await fs.writeFile(path.join(projectPath, 'README.md'), readmeContent);
            
            // Initial commit
            execSync('git add .', { cwd: projectPath, stdio: 'ignore' });
            execSync('git commit -m "Initial commit"', { cwd: projectPath, stdio: 'ignore' });
        } catch (gitError) {
            console.warn('Git initialization failed:', gitError.message);
        }
        
        res.json({ 
            message: 'Project created successfully', 
            name: sanitizedName,
            path: projectPath
        });
        
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});

// Get project details
router.get('/:projectName', async (req, res) => {
    try {
        const { projectName } = req.params;
        
        if (!isSafePath(projectName)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const projectPath = path.join(PROJECTS_DIR, projectName);
        
        try {
            const stat = await fs.stat(projectPath);
            if (!stat.isDirectory()) {
                return res.status(404).json({ error: 'Project not found' });
            }
        } catch {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        // Get project info
        const projectInfo = {
            name: projectName,
            path: projectPath,
            created: stat.birthtime,
            modified: stat.mtime
        };
        
        // Check if it's a git repository
        try {
            const gitPath = path.join(projectPath, '.git');
            await fs.access(gitPath);
            projectInfo.isGitRepo = true;
            
            // Get current branch
            try {
                const branch = execSync('git branch --show-current', { 
                    cwd: projectPath, 
                    encoding: 'utf8' 
                }).trim();
                projectInfo.currentBranch = branch;
            } catch {
                projectInfo.currentBranch = 'unknown';
            }
        } catch {
            projectInfo.isGitRepo = false;
        }
        
        res.json(projectInfo);
        
    } catch (error) {
        console.error('Error getting project details:', error);
        res.status(500).json({ error: 'Failed to get project details' });
    }
});

// Delete a project
router.delete('/:projectName', async (req, res) => {
    try {
        const { projectName } = req.params;
        
        if (!isSafePath(projectName)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const projectPath = path.join(PROJECTS_DIR, projectName);
        
        // Check if project exists
        try {
            const stat = await fs.stat(projectPath);
            if (!stat.isDirectory()) {
                return res.status(404).json({ error: 'Project not found' });
            }
        } catch {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        // Remove project directory
        await fs.rm(projectPath, { recursive: true, force: true });
        
        res.json({ message: 'Project deleted successfully' });
        
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

module.exports = router;
module.exports.PROJECTS_DIR = PROJECTS_DIR;
module.exports.isSafePath = isSafePath;