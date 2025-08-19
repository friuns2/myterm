const express = require('express');
const path = require('path');
const { PROJECTS_DIR } = require('../middleware/security');
const { execSync, exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const router = express.Router();

// Function to scan all development ports globally
async function scanAllDevelopmentPorts() {
    // Check if port scanning is enabled via environment variable
    if (process.env.ENABLE_PORT_SCANNING !== 'true') {
        return [];
    }
    
    const ports = [];
    try {
        // Use optimized lsof command for faster execution with timeout
        const { stdout: lsofOutput } = await execAsync(`lsof -iTCP -sTCP:LISTEN -P -n | awk '$9 ~ /:3[0-9][0-9][0-9]$/ || $9 ~ /:4000$/ || $9 ~ /:5[1-9][0-9][0-9]$/ || $9 ~ /:6000$/ || $9 ~ /:9[0-9][0-9][0-9]$/ || $9 ~ /:10000$/ {print $9}'`, { 
            encoding: 'utf8',
            timeout: 500 // 5 second timeout
        });
        const lines = lsofOutput.split('\n').filter(Boolean);
        
        for (const line of lines) {
            const match = line.match(/:([0-9]+)$/);
            if (match) {
                const port = parseInt(match[1]);
                if (port && !ports.includes(port)) {
                    ports.push(port);
                }
            }
        }
    } catch (_) {
        // Ignore errors, return empty array
    }
    
    return [...new Set(ports)].sort((a, b) => a - b);
}

// API endpoint to get all sessions across all projects
router.get('/', async (req, res) => {
    // Source of truth: list tmux sessions; augment with in-memory attach clients if any
    let tmuxSessions = [];
    try {
        const { stdout: out } = await execAsync('tmux list-sessions -F "#{session_name}|#{session_created}|#{session_path}|#{pane_title}" 2>/dev/null || true', { 
            encoding: 'utf8',
            timeout: 3000 // 3 second timeout
        });
        tmuxSessions = out
            .split('\n')
            .filter(Boolean)
            .map(line => {
                const [name, createdTimestamp, pathStr, title] = line.split('|');
                // Convert Unix timestamp to ISO string
                const createdStr = createdTimestamp ? new Date(parseInt(createdTimestamp) * 1000).toISOString() : new Date().toISOString();
                return { name, createdStr, pathStr, title };
            });
    } catch (e) {
        // No tmux or no sessions
        tmuxSessions = [];
    }

	// Build response: include raw pane thumbnail (visible screen with ANSI)
	const all = await Promise.all(tmuxSessions.map(async ts => {
		let thumbnail = '';
		let lastCommitSubject = '';
		let lastCommitShortHash = '';
		try {
			const safeName = JSON.stringify(ts.name).slice(1, -1); // safely quoted tmux target
			
			const { stdout: thumbnailOutput } = await execAsync(`tmux capture-pane -ep -t ${safeName}`, { 
				encoding: 'utf8',
				timeout: 2000 // 2 second timeout
			});
			thumbnail = thumbnailOutput;
			
		} catch (_) {
			thumbnail = '';
		}

        // Try to fetch last commit details if inside a git repo
        try {
            if (ts.pathStr) {
                const { stdout: isGit } = await execAsync(`git -C ${JSON.stringify(ts.pathStr).slice(1, -1)} rev-parse --is-inside-work-tree 2>/dev/null || echo no`, { 
                    encoding: 'utf8',
                    timeout: 2000 // 2 second timeout
                });
                if (isGit.trim() === 'true') {
                    const [subjectResult, hashResult] = await Promise.all([
                        execAsync(`git -C ${JSON.stringify(ts.pathStr).slice(1, -1)} log -1 --pretty=%s`, { 
                            encoding: 'utf8',
                            timeout: 2000
                        }),
                        execAsync(`git -C ${JSON.stringify(ts.pathStr).slice(1, -1)} log -1 --pretty=%h`, { 
                            encoding: 'utf8',
                            timeout: 2000
                        })
                    ]);
                    lastCommitSubject = subjectResult.stdout.trim();
                    lastCommitShortHash = hashResult.stdout.trim();
                }
            }
        } catch (_) {
            // ignore git errors
        }

		// Derive project name from session path relative to PROJECTS_DIR to preserve slashes
		let projectName = 'Unknown';
		try {
			if (ts.pathStr) {
				const rel = path.relative(PROJECTS_DIR, ts.pathStr);
				if (rel && !rel.startsWith('..')) {
					projectName = rel.split(path.sep).join('/');
				} else {
					projectName = path.basename(ts.pathStr);
				}
			}
		} catch (_) {}

		return {
			id: ts.name,
			path: ts.pathStr || '',
			thumbnail: thumbnail || '',
			lastCommitSubject,
			lastCommitShortHash,
			created: ts.createdStr || new Date().toISOString(),
			projectName,
			title: ts.title || ''
		};
    }));

    // Sort sessions by creation time, newest first
    all.sort((a, b) => new Date(b.created) - new Date(a.created));

    res.json(all);
});

// GET /api/sessions/ports - Get all development ports
router.get('/ports', async (req, res) => {
    try {
        const ports = await scanAllDevelopmentPorts();
        res.json({ ports });
    } catch (error) {
        console.error('Error getting ports:', error);
        res.status(500).json({ error: 'Failed to get ports' });
    }
});





// API endpoint to kill a session
router.delete('/:sessionId', async (req, res) => {
    const sessionId = req.params.sessionId;
    try {
        await execAsync(`tmux kill-session -t ${sessionId}`, { timeout: 3000 });
        res.json({ success: true, message: 'Tmux session killed successfully' });
    } catch (e) {
        res.status(404).json({ success: false, message: 'Session not found or failed to kill' });
    }
});

// API endpoint to rename a session
router.put('/:sessionId/rename', async (req, res) => {
    const sessionId = req.params.sessionId;
    const { newName } = req.body;
    
    if (!newName || typeof newName !== 'string' || newName.trim() === '') {
        return res.status(400).json({ success: false, message: 'New session name is required' });
    }
    
    const sanitizedNewName = newName.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    
    try {
        // Check if the new session name already exists
        try {
            await execAsync(`tmux has-session -t ${sanitizedNewName}`, { timeout: 2000 });
            return res.status(409).json({ success: false, message: 'Session with this name already exists' });
        } catch (e) {
            // Session doesn't exist, which is what we want
        }
        
        // Rename the session
        await execAsync(`tmux rename-session -t ${sessionId} ${sanitizedNewName}`, { timeout: 3000 });
        res.json({ 
            success: true, 
            message: 'Tmux session renamed successfully',
            oldName: sessionId,
            newName: sanitizedNewName
        });
    } catch (e) {
        res.status(404).json({ success: false, message: 'Session not found or failed to rename' });
    }
});

// DELETE /api/sessions/ports/:port - Kill process by port globally
router.delete('/ports/:port', async (req, res) => {
    const { port } = req.params;
    const portNum = parseInt(port);
    
    try {
        // Find the process using the port
        const { stdout: lsofOutput } = await execAsync(`lsof -ti:${port} 2>/dev/null || true`, { 
            encoding: 'utf8',
            timeout: 3000
        });
        const pids = lsofOutput.split('\n').filter(pid => pid.trim() && /^\d+$/.test(pid.trim()));
        
        // Kill all processes using this port
        let killedCount = 0;
        for (const pid of pids) {
            try {
                await execAsync(`kill -9 ${pid}`, { timeout: 2000 });
                killedCount++;
            } catch (killError) {
                console.warn(`Failed to kill process ${pid}:`, killError.message);
            }
        }
        
        if (killedCount > 0) {
            res.json({ 
                success: true, 
                message: `Killed ${killedCount} process(es) on port ${port}`,
                killedPids: pids.slice(0, killedCount)
            });
        } else {
            res.status(500).json({ error: `Failed to kill processes on port ${port}` });
        }
        
    } catch (error) {
        console.error(`Error killing process on port ${port}:`, error);
        res.status(500).json({ error: 'Failed to kill process' });
    }
});

// API endpoint to kill process by port
router.delete('/:sessionId/ports/:port', async (req, res) => {
    const sessionId = req.params.sessionId;
    const port = parseInt(req.params.port);
    
    if (!port || port < 1 || port > 65535) {
        return res.status(400).json({ success: false, message: 'Invalid port number' });
    }
    
    try {
        // Find the process using the port
        const { stdout: lsofOutput } = await execAsync(`lsof -ti:${port} 2>/dev/null || true`, { 
            encoding: 'utf8',
            timeout: 3000
        });
        const pids = lsofOutput.split('\n').filter(pid => pid.trim() && /^\d+$/.test(pid.trim()));
        
        if (pids.length === 0) {
            return res.status(404).json({ success: false, message: `No process found using port ${port}` });
        }
        
        // Kill all processes using this port
        let killedCount = 0;
        for (const pid of pids) {
            try {
                await execAsync(`kill ${pid}`, { timeout: 2000 });
                killedCount++;
            } catch (killError) {
                // Try force kill if regular kill fails
                try {
                    await execAsync(`kill -9 ${pid}`, { timeout: 2000 });
                    killedCount++;
                } catch (_) {
                    // Ignore if process already dead or can't be killed
                }
            }
        }
        
        if (killedCount > 0) {
            res.json({ 
                success: true, 
                message: `Killed ${killedCount} process(es) using port ${port}`
            });
        } else {
            res.status(500).json({ success: false, message: `Failed to kill processes using port ${port}` });
        }
    } catch (error) {
        console.error('Error killing process by port:', error);
        res.status(500).json({ success: false, message: 'Failed to kill process' });
    }
});

// API endpoint to get tmux pane history
router.get('/:sessionId/history', async (req, res) => {
    const sessionId = req.params.sessionId;
    const lines = req.query.lines || '100000'; // Default to 100k lines
    
    try {
        // Capture pane history from tmux
        const { stdout: history } = await execAsync(`tmux capture-pane -p -S -${lines} -t ${sessionId}`, { 
            encoding: 'utf8',
            timeout: 5000 // 5 second timeout for large history
        });
        res.json({ success: true, history });
    } catch (error) {
        console.error('Error capturing tmux history:', error);
        res.status(404).json({ success: false, error: 'Session not found or failed to capture history' });
    }
});

module.exports = router;