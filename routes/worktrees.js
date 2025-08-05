// Git worktree management routes
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const { PROJECTS_DIR, isSafePath } = require('./projects');

const router = express.Router({ mergeParams: true });

// Helper function to execute git commands safely
function executeGitCommand(command, cwd) {
    try {
        return execSync(command, { 
            cwd, 
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        }).trim();
    } catch (error) {
        throw new Error(`Git command failed: ${error.message}`);
    }
}

// Helper function to parse worktree list
function parseWorktrees(worktreeOutput) {
    const lines = worktreeOutput.split('\n').filter(line => line.trim());
    const worktrees = [];
    
    for (const line of lines) {
        const match = line.match(/^(.+?)\s+([a-f0-9]+)\s+\[(.+?)\](.*)$/);
        if (match) {
            const [, worktreePath, commit, branch, status] = match;
            const name = path.basename(worktreePath);
            
            worktrees.push({
                name,
                path: worktreePath,
                branch: branch.trim(),
                commit: commit.trim(),
                status: status.trim(),
                isMain: name === path.basename(worktreePath.replace(/\/\.git\/worktrees\/.*$/, ''))
            });
        }
    }
    
    return worktrees;
}

// Get all worktrees for a project
router.get('/', async (req, res) => {
    try {
        const { projectName } = req.params;
        
        if (!isSafePath(projectName)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const projectPath = path.join(PROJECTS_DIR, projectName);
        
        // Check if project exists and is a git repository
        try {
            await fs.access(path.join(projectPath, '.git'));
        } catch {
            return res.status(400).json({ error: 'Project is not a git repository' });
        }
        
        try {
            const worktreeOutput = executeGitCommand('git worktree list --porcelain', projectPath);
            const worktrees = parseWorktrees(worktreeOutput);
            res.json(worktrees);
        } catch (error) {
            console.error('Error listing worktrees:', error);
            res.json([]); // Return empty array if no worktrees or error
        }
        
    } catch (error) {
        console.error('Error getting worktrees:', error);
        res.status(500).json({ error: 'Failed to get worktrees' });
    }
});

// Create a new worktree
router.post('/', async (req, res) => {
    try {
        const { projectName } = req.params;
        const { name, branch } = req.body;
        
        if (!name || !branch) {
            return res.status(400).json({ error: 'Worktree name and branch are required' });
        }
        
        if (!isSafePath(projectName)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Sanitize worktree name
        const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '');
        if (!sanitizedName) {
            return res.status(400).json({ error: 'Invalid worktree name' });
        }
        
        const projectPath = path.join(PROJECTS_DIR, projectName);
        const worktreePath = path.join(projectPath, '..', `${projectName}-${sanitizedName}`);
        
        // Check if project exists and is a git repository
        try {
            await fs.access(path.join(projectPath, '.git'));
        } catch {
            return res.status(400).json({ error: 'Project is not a git repository' });
        }
        
        // Check if worktree already exists
        try {
            await fs.access(worktreePath);
            return res.status(409).json({ error: 'Worktree already exists' });
        } catch {
            // Worktree doesn't exist, continue
        }
        
        try {
            // Create new worktree
            executeGitCommand(`git worktree add "${worktreePath}" -b "${branch}"`, projectPath);
            
            res.json({
                message: 'Worktree created successfully',
                name: sanitizedName,
                branch,
                path: worktreePath
            });
        } catch (error) {
            console.error('Error creating worktree:', error);
            res.status(500).json({ error: `Failed to create worktree: ${error.message}` });
        }
        
    } catch (error) {
        console.error('Error creating worktree:', error);
        res.status(500).json({ error: 'Failed to create worktree' });
    }
});

// Open worktree (switch to it)
router.post('/:worktreeName/open', async (req, res) => {
    try {
        const { projectName, worktreeName } = req.params;
        
        if (!isSafePath(projectName)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const projectPath = path.join(PROJECTS_DIR, projectName);
        const worktreePath = path.join(projectPath, '..', `${projectName}-${worktreeName}`);
        
        // Check if worktree exists
        try {
            await fs.access(worktreePath);
        } catch {
            return res.status(404).json({ error: 'Worktree not found' });
        }
        
        // For now, just return success. In a real implementation,
        // you might want to update some state or configuration
        res.json({
            message: 'Worktree opened successfully',
            path: worktreePath
        });
        
    } catch (error) {
        console.error('Error opening worktree:', error);
        res.status(500).json({ error: 'Failed to open worktree' });
    }
});

// Merge worktree
router.post('/:worktreeName/merge', async (req, res) => {
    try {
        const { projectName, worktreeName } = req.params;
        
        if (!isSafePath(projectName)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const projectPath = path.join(PROJECTS_DIR, projectName);
        const worktreePath = path.join(projectPath, '..', `${projectName}-${worktreeName}`);
        
        // Check if worktree exists
        try {
            await fs.access(worktreePath);
        } catch {
            return res.status(404).json({ error: 'Worktree not found' });
        }
        
        try {
            // Get the branch name from the worktree
            const branch = executeGitCommand('git branch --show-current', worktreePath);
            
            // Switch to main branch in main repository
            executeGitCommand('git checkout main', projectPath);
            
            // Merge the worktree branch
            executeGitCommand(`git merge "${branch}"`, projectPath);
            
            res.json({
                message: 'Worktree merged successfully',
                branch,
                mergedInto: 'main'
            });
        } catch (error) {
            console.error('Error merging worktree:', error);
            res.status(500).json({ error: `Failed to merge worktree: ${error.message}` });
        }
        
    } catch (error) {
        console.error('Error merging worktree:', error);
        res.status(500).json({ error: 'Failed to merge worktree' });
    }
});

// Delete worktree
router.delete('/:worktreeName', async (req, res) => {
    try {
        const { projectName, worktreeName } = req.params;
        
        if (!isSafePath(projectName)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const projectPath = path.join(PROJECTS_DIR, projectName);
        const worktreePath = path.join(projectPath, '..', `${projectName}-${worktreeName}`);
        
        // Check if worktree exists
        try {
            await fs.access(worktreePath);
        } catch {
            return res.status(404).json({ error: 'Worktree not found' });
        }
        
        try {
            // Remove worktree
            executeGitCommand(`git worktree remove "${worktreePath}" --force`, projectPath);
            
            res.json({
                message: 'Worktree deleted successfully',
                name: worktreeName
            });
        } catch (error) {
            console.error('Error deleting worktree:', error);
            res.status(500).json({ error: `Failed to delete worktree: ${error.message}` });
        }
        
    } catch (error) {
        console.error('Error deleting worktree:', error);
        res.status(500).json({ error: 'Failed to delete worktree' });
    }
});

module.exports = router;