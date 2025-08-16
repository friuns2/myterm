const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const { PROJECTS_DIR } = require('../middleware/security');

const router = express.Router();



// API endpoint to create a new project
router.post('/', express.json(), (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: 'Project name is required' });
    }
    
    const projectPath = path.join(PROJECTS_DIR, name.trim());
    try {
        if (fs.existsSync(projectPath)) {
            return res.status(409).json({ error: 'Project already exists' });
        }
        fs.mkdirSync(projectPath, { recursive: true });
        // Run git init and create initial commit in the new project directory
        const commands = [
            'git init',
            'echo "# ' + name.trim() + '" > README.md',
            'git add README.md',
            'git commit -m "Initial commit"'
        ];
        
        let commandIndex = 0;
        
        const runNextCommand = () => {
            if (commandIndex >= commands.length) {
                console.log(`Git initialized with initial commit in ${projectPath}`);
                return res.json({ success: true, name: name.trim() });
            }
            
            const command = commands[commandIndex];
            commandIndex++;
            
            exec(command, { cwd: projectPath }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error running "${command}" in ${projectPath}:`, error);
                    return res.status(500).json({ error: `Failed to initialize git in project: ${error.message}` });
                }
                
                runNextCommand();
            });
        };
        
        runNextCommand();
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});

// API endpoint to get all projects with their worktrees (used directly in server.js)
function getProjectsWithWorktrees(req, res) {
    try {
        if (!fs.existsSync(PROJECTS_DIR)) {
            fs.mkdirSync(PROJECTS_DIR, { recursive: true });
        }
        const projects = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
            .filter(dirent => {
                if (dirent.isDirectory()) {
                    return true;
                }
                // Check if it's a symbolic link pointing to a directory
                if (dirent.isSymbolicLink()) {
                    try {
                        const fullPath = path.join(PROJECTS_DIR, dirent.name);
                        const stats = fs.statSync(fullPath);
                        return stats.isDirectory();
                    } catch (error) {
                        // If we can't stat the symlink target, exclude it
                        return false;
                    }
                }
                return false;
            })
            .map(dirent => dirent.name);
        
        const projectsWithWorktrees = [];
        
        for (const projectName of projects) {
            const projectPath = path.join(PROJECTS_DIR, projectName);
            const gitPath = path.join(projectPath, '.git');
            
            const projectData = {
                name: projectName,
                worktrees: []
            };
            
            if (fs.existsSync(gitPath)) {
                try {
                    const { execSync } = require('child_process');
                    const stdout = execSync('git worktree list --porcelain', { cwd: projectPath, encoding: 'utf8' });
                    
                    const worktrees = [];
                    const lines = stdout.split('\n');
                    let currentWorktree = {};
                    
                    for (const line of lines) {
                        if (line.startsWith('worktree ')) {
                            if (currentWorktree.path) {
                                worktrees.push(currentWorktree);
                            }
                            currentWorktree = { path: line.replace('worktree ', '') };
                        } else if (line.startsWith('HEAD ')) {
                            currentWorktree.commit = line.replace('HEAD ', '');
                        } else if (line.startsWith('branch ')) {
                            currentWorktree.branch = line.replace('branch refs/heads/', '');
                        } else if (line.startsWith('detached')) {
                            currentWorktree.detached = true;
                        }
                    }
                    
                    if (currentWorktree.path) {
                        worktrees.push(currentWorktree);
                    }
                    
                    // Filter out the main repository and only show worktrees in the worktrees directory
                    const filteredWorktrees = worktrees.filter(wt => {
                        const wtPath = wt.path;
                        const worktreesDir = path.join(projectPath, 'worktrees');
                        return wtPath.startsWith(worktreesDir);
                    });
                    
                    projectData.worktrees = filteredWorktrees.map(wt => ({
                        name: path.basename(wt.path),
                        branch: wt.branch || (wt.detached ? 'detached' : 'main'),
                        relativePath: path.relative(projectPath, wt.path)
                    }));
                } catch (error) {
                    // If git command fails, just set empty worktrees
                    projectData.worktrees = [];
                }
            }
            
            projectsWithWorktrees.push(projectData);
        }
        
        res.json(projectsWithWorktrees);
    } catch (error) {
        console.error('Error reading projects with worktrees:', error);
        res.status(500).json({ error: 'Failed to read projects with worktrees' });
    }
}



// API endpoint to delete a project
router.delete('/:projectName', (req, res) => {
    const projectName = req.params.projectName;
    const projectPath = path.join(PROJECTS_DIR, projectName);

    if (!fs.existsSync(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
    }

    try {
        // First, find and kill all tmux sessions associated with this project
        let killedSessions = [];
        try {
            const out = execSync('tmux list-sessions -F "#{session_name}|#{session_path}" 2>/dev/null || true', { encoding: 'utf8' });
            const sessions = out
                .split('\n')
                .filter(Boolean)
                .map(line => {
                    const [name, sessionPath] = line.split('|');
                    return { name, sessionPath };
                })
                .filter(session => {
                    // Check if session path is within the project directory
                    return session.sessionPath && session.sessionPath.startsWith(projectPath);
                });

            // Kill each session associated with this project
            for (const session of sessions) {
                try {
                    execSync(`tmux kill-session -t ${session.name}`);
                    killedSessions.push(session.name);
                    console.log(`Killed tmux session: ${session.name}`);
                } catch (killError) {
                    console.warn(`Failed to kill session ${session.name}:`, killError.message);
                }
            }
        } catch (tmuxError) {
            // No tmux or no sessions, continue with project deletion
            console.log('No tmux sessions found or tmux not available');
        }

        // Remove the entire project directory
        fs.rmSync(projectPath, { recursive: true, force: true });
        console.log(`Project deleted: ${projectPath}`);
        
        const message = killedSessions.length > 0 
            ? `Project ${projectName} deleted successfully. Closed ${killedSessions.length} session(s): ${killedSessions.join(', ')}`
            : `Project ${projectName} deleted successfully`;
            
        res.json({ success: true, message });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: `Failed to delete project: ${error.message}` });
    }
});

module.exports = router;
module.exports.getProjectsWithWorktrees = getProjectsWithWorktrees;