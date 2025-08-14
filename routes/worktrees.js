const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { PROJECTS_DIR } = require('../middleware/security');

const router = express.Router();

// Helper: auto-commit pending changes in a git repo if any
function autoCommitIfNeeded(cwd, message, callback) {
    const safeMsg = String(message || 'Auto-commit').replace(/"/g, '\"');
    const cmd = `sh -lc 'git add -A && (git diff --cached --quiet || git commit -m "${safeMsg}")'`;
    exec(cmd, { cwd }, (error) => {
        if (error) return callback(new Error(`Failed to auto-commit in ${cwd}: ${error.message}`));
        callback(null);
    });
}

// API endpoint to get worktrees for a project
router.get('/projects/:projectName/worktrees', (req, res) => {
    const projectName = req.params.projectName;
    const projectPath = path.join(PROJECTS_DIR, projectName);
    
    if (!fs.existsSync(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
    }

    // Check if it's a git repository
    const gitPath = path.join(projectPath, '.git');
    if (!fs.existsSync(gitPath)) {
        return res.json([]); // Return empty array if not a git repo
    }

    // Get list of worktrees using git worktree list
    exec('git worktree list --porcelain', { cwd: projectPath }, (error, stdout, stderr) => {
        if (error) {
            console.error('Error listing worktrees:', error);
            return res.json([]); // Return empty array on error
        }

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
            } else if (line.startsWith('bare')) {
                currentWorktree.bare = true;
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
        }).map(wt => ({
            ...wt,
            name: path.basename(wt.path),
            relativePath: path.relative(projectPath, wt.path)
        }));

        res.json(filteredWorktrees);
    });
});

// API endpoint to create a new worktree
router.post('/projects/:projectName/worktrees', express.json(), (req, res) => {
    const projectName = req.params.projectName;
    const { name, branch } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: 'Worktree name is required' });
    }

    const projectPath = path.join(PROJECTS_DIR, projectName);
    const worktreesDir = path.join(projectPath, 'worktrees');
    const worktreePath = path.join(worktreesDir, name.trim());

    if (!fs.existsSync(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
    }

    // Check if it's a git repository
    const gitPath = path.join(projectPath, '.git');
    if (!fs.existsSync(gitPath)) {
        return res.status(400).json({ error: 'Project is not a git repository' });
    }

    // Create worktrees directory if it doesn't exist
    if (!fs.existsSync(worktreesDir)) {
        fs.mkdirSync(worktreesDir, { recursive: true });
    }

    // Check if worktree already exists
    if (fs.existsSync(worktreePath)) {
        return res.status(409).json({ error: 'Worktree already exists' });
    }

    // Commit pending changes first in main repo, then create the worktree
    autoCommitIfNeeded(projectPath, `chore(worktree): auto-commit before creating ${name}`, (commitErr) => {
        if (commitErr) {
            console.warn(commitErr.message);
        }
        const branchArg = branch ? `-b ${branch}` : '';
        const command = `git worktree add ${branchArg} ${worktreePath}`;
        exec(command, { cwd: projectPath }, (error) => {
            if (error) {
                console.error('Error creating worktree:', error);
                return res.status(500).json({ error: `Failed to create worktree: ${error.message}` });
            }
            console.log(`Worktree created: ${worktreePath}`);
            res.json({ success: true, name: name.trim(), path: worktreePath });
        });
    });
});

// API endpoint to merge a worktree back to main
router.post('/projects/:projectName/worktrees/:worktreeName/merge', express.json(), (req, res) => {
    const projectName = req.params.projectName;
    const worktreeName = req.params.worktreeName;
    const { targetBranch = 'main' } = req.body;
    
    const projectPath = path.join(PROJECTS_DIR, projectName);
    const worktreePath = path.join(projectPath, 'worktrees', worktreeName);

    if (!fs.existsSync(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
    }

    if (!fs.existsSync(worktreePath)) {
        return res.status(404).json({ error: 'Worktree not found' });
    }

    // First, auto-commit pending changes inside the worktree, then get the current branch
    autoCommitIfNeeded(worktreePath, `chore(worktree): auto-commit before merge ${worktreeName}`, (acErr) => {
        if (acErr) {
            console.warn(acErr.message);
        }
        exec('git branch --show-current', { cwd: worktreePath }, (error, branchOutput, stderr) => {
        if (error) {
            return res.status(500).json({ error: `Failed to get worktree branch: ${error.message}` });
        }

        const currentBranch = branchOutput.trim();
        if (!currentBranch) {
            return res.status(400).json({ error: 'Worktree is in detached HEAD state' });
        }

            // Auto-commit in the main repo as well, then merge
            autoCommitIfNeeded(projectPath, `chore(worktree): auto-commit before merging ${currentBranch} into ${targetBranch}`, (mainAcErr) => {
                if (mainAcErr) {
                    console.warn(mainAcErr.message);
                }
                // Switch to target branch in main repository and merge
                const mergeCommands = [
                    `git checkout ${targetBranch}`,
                    `git merge ${currentBranch}`,
                    `git worktree remove ${worktreePath}`,
                    `git branch -d ${currentBranch}`
                ];

                let commandIndex = 0;
                
                const runNextCommand = () => {
                    if (commandIndex >= mergeCommands.length) {
                        return res.json({ success: true, message: `Worktree ${worktreeName} merged and removed successfully` });
                    }

                    const command = mergeCommands[commandIndex];
                    commandIndex++;

                    exec(command, { cwd: projectPath }, (error, stdout, stderr) => {
                        if (error) {
                            console.error(`Error running "${command}":`, error);
                            return res.status(500).json({ error: `Failed to execute: ${command}. Error: ${error.message}` });
                        }
                        
                        runNextCommand();
                    });
                };

                runNextCommand();
            });
        });
    });
});

// API endpoint to delete a worktree
router.delete('/projects/:projectName/worktrees/:worktreeName', (req, res) => {
    const projectName = req.params.projectName;
    const worktreeName = req.params.worktreeName;
    
    const projectPath = path.join(PROJECTS_DIR, projectName);
    const worktreePath = path.join(projectPath, 'worktrees', worktreeName);

    if (!fs.existsSync(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
    }

    if (!fs.existsSync(worktreePath)) {
        return res.status(404).json({ error: 'Worktree not found' });
    }

    // First, detect the branch used by this worktree (if any)
    exec('git branch --show-current', { cwd: worktreePath }, (branchErr, branchStdout) => {
        const currentBranch = (branchStdout || '').trim();

        // Remove the worktree
        exec(`git worktree remove ${worktreePath}`, { cwd: projectPath }, (rmErr) => {
            if (rmErr) {
                console.error('Error removing worktree:', rmErr);
                return res.status(500).json({ error: `Failed to remove worktree: ${rmErr.message}` });
            }

            if (!currentBranch) {
                console.log(`Worktree removed: ${worktreePath} (no branch to delete or detached HEAD)`);
                return res.json({ success: true, message: `Worktree ${worktreeName} removed successfully` });
            }

            // Try to delete the branch in the main repo
            exec(`git branch -d ${currentBranch}`, { cwd: projectPath }, (delErr) => {
                if (!delErr) {
                    console.log(`Worktree and branch removed: ${worktreePath}, ${currentBranch}`);
                    return res.json({ success: true, message: `Worktree ${worktreeName} and branch ${currentBranch} removed successfully` });
                }

                // If not fully merged, force delete
                exec(`git branch -D ${currentBranch}`, { cwd: projectPath }, (forceErr) => {
                    if (forceErr) {
                        console.warn(`Worktree removed, but failed to delete branch ${currentBranch}: ${forceErr.message}`);
                        return res.json({ success: true, message: `Worktree ${worktreeName} removed. Failed to delete branch ${currentBranch}: ${forceErr.message}` });
                    }
                    console.log(`Worktree removed and branch force-deleted: ${worktreePath}, ${currentBranch}`);
                    return res.json({ success: true, message: `Worktree ${worktreeName} removed and branch ${currentBranch} force-deleted` });
                });
            });
        });
    });
});

module.exports = router; 