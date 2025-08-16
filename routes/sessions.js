const express = require('express');
const path = require('path');
const { PROJECTS_DIR } = require('../middleware/security');
const { execSync } = require('child_process');

const router = express.Router();

// Function to scan all development ports globally
function scanAllDevelopmentPorts() {
    // Check if port scanning is enabled via environment variable
    if (process.env.ENABLE_PORT_SCANNING !== 'true') {
        return [];
    }
    
    const ports = [];
    try {
        // Use optimized lsof command for faster execution
        const lsofOutput = execSync(`lsof -iTCP -sTCP:LISTEN -P -n | awk '$9 ~ /:3[0-9][0-9][0-9]$/ || $9 ~ /:4000$/ || $9 ~ /:5[1-9][0-9][0-9]$/ || $9 ~ /:6000$/ || $9 ~ /:9[0-9][0-9][0-9]$/ || $9 ~ /:10000$/ {print $9}'`, { encoding: 'utf8' });
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
router.get('/', (req, res) => {
    // Source of truth: list tmux sessions; augment with in-memory attach clients if any
    let tmuxSessions = [];
    try {
        const out = execSync('tmux list-sessions -F "#{session_name}|#{session_created}|#{session_path}|#{pane_title}" 2>/dev/null || true', { encoding: 'utf8' });
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
	const all = tmuxSessions.map(ts => {
		let thumbnail = '';
		let lastCommitSubject = '';
		let lastCommitShortHash = '';
		try {
			const safeName = JSON.stringify(ts.name).slice(1, -1); // safely quoted tmux target
			
			thumbnail = execSync(`tmux capture-pane -ep -t ${safeName}`, { encoding: 'utf8' });
			
		} catch (_) {
			thumbnail = '';
		}

        // Try to fetch last commit details if inside a git repo
        try {
            if (ts.pathStr) {
                const isGit = execSync(`git -C ${JSON.stringify(ts.pathStr).slice(1, -1)} rev-parse --is-inside-work-tree 2>/dev/null || echo no`, { encoding: 'utf8' }).trim();
                if (isGit === 'true') {
                    lastCommitSubject = execSync(`git -C ${JSON.stringify(ts.pathStr).slice(1, -1)} log -1 --pretty=%s`, { encoding: 'utf8' }).trim();
                    lastCommitShortHash = execSync(`git -C ${JSON.stringify(ts.pathStr).slice(1, -1)} log -1 --pretty=%h`, { encoding: 'utf8' }).trim();
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
    });

    // Sort sessions by creation time, newest first
    all.sort((a, b) => new Date(b.created) - new Date(a.created));

    res.json(all);
});

// API endpoint to get all development ports
router.get('/ports', (req, res) => {
    try {
        const ports = scanAllDevelopmentPorts();
        res.json({ ports });
    } catch (error) {
        console.error('Error getting ports:', error);
        res.status(500).json({ error: 'Failed to get ports' });
    }
});

// API endpoint to create pinggy.io tunnel
router.post('/create-tunnel', (req, res) => {
    const { port } = req.body;
    
    if (!port || port < 1 || port > 65535) {
        return res.status(400).json({ success: false, message: 'Invalid port number' });
    }
    
    try {
        // Check if port is actually in use
        const lsofOutput = execSync(`lsof -ti:${port} 2>/dev/null || true`, { encoding: 'utf8' });
        const pids = lsofOutput.split('\n').filter(pid => pid.trim() && /^\d+$/.test(pid.trim()));
        
        if (pids.length === 0) {
            return res.status(404).json({ success: false, message: `No process found on port ${port}` });
        }
        
        // Create pinggy tunnel in background using &
        const tunnelCommand = `ssh -p 443 -R0:localhost:${port} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null qr@a.pinggy.io 2>&1 | grep -o 'https://[^[:space:]]*' | head -1 > /tmp/pinggy_${port}.url &`;
        
        execSync(tunnelCommand, { encoding: 'utf8' });
        
        // Wait a moment for the tunnel to establish
        setTimeout(() => {
            try {
                const tunnelUrl = execSync(`cat /tmp/pinggy_${port}.url 2>/dev/null || echo ''`, { encoding: 'utf8' }).trim();
                
                if (tunnelUrl && tunnelUrl.startsWith('https://')) {
                    res.json({ 
                        success: true, 
                        url: tunnelUrl,
                        message: `Tunnel created for port ${port}` 
                    });
                } else {
                    res.status(500).json({ 
                        success: false, 
                        message: 'Failed to get tunnel URL. Please try again.' 
                    });
                }
            } catch (error) {
                console.error('Error reading tunnel URL:', error);
                res.status(500).json({ 
                    success: false, 
                    message: 'Failed to create tunnel. Please try again.' 
                });
            }
        }, 3000); // Wait 3 seconds for tunnel to establish
        
    } catch (error) {
        console.error(`Error creating tunnel for port ${port}:`, error);
        res.status(500).json({ success: false, message: 'Failed to create tunnel' });
    }
});

// API endpoint to kill a session
router.delete('/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    try {
        execSync(`tmux kill-session -t ${sessionId}`);
        res.json({ success: true, message: 'Tmux session killed successfully' });
    } catch (e) {
        res.status(404).json({ success: false, message: 'Session not found or failed to kill' });
    }
});

// DELETE /api/sessions/ports/:port - Kill process by port globally
router.delete('/ports/:port', (req, res) => {
    const { port } = req.params;
    
    try {
        // Find the process using the port
        const lsofOutput = execSync(`lsof -ti:${port} 2>/dev/null || true`, { encoding: 'utf8' });
        const pids = lsofOutput.split('\n').filter(pid => pid.trim() && /^\d+$/.test(pid.trim()));
        
        if (pids.length === 0) {
            return res.status(404).json({ error: `No process found on port ${port}` });
        }
        
        // Kill all processes using this port
        let killedCount = 0;
        for (const pid of pids) {
            try {
                execSync(`kill -9 ${pid}`);
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
router.delete('/:sessionId/ports/:port', (req, res) => {
    const sessionId = req.params.sessionId;
    const port = parseInt(req.params.port);
    
    if (!port || port < 1 || port > 65535) {
        return res.status(400).json({ success: false, message: 'Invalid port number' });
    }
    
    try {
        // Find the process using the port
        const lsofOutput = execSync(`lsof -ti:${port} 2>/dev/null || true`, { encoding: 'utf8' });
        const pids = lsofOutput.split('\n').filter(pid => pid.trim() && /^\d+$/.test(pid.trim()));
        
        if (pids.length === 0) {
            return res.status(404).json({ success: false, message: `No process found using port ${port}` });
        }
        
        // Kill all processes using this port
        let killedCount = 0;
        for (const pid of pids) {
            try {
                execSync(`kill ${pid}`);
                killedCount++;
            } catch (killError) {
                // Try force kill if regular kill fails
                try {
                    execSync(`kill -9 ${pid}`);
                    killedCount++;
                } catch (_) {
                    // Ignore if process already dead or can't be killed
                }
            }
        }
        
        if (killedCount > 0) {
            res.json({ success: true, message: `Killed ${killedCount} process(es) using port ${port}` });
        } else {
            res.status(500).json({ success: false, message: `Failed to kill processes using port ${port}` });
        }
    } catch (error) {
        console.error('Error killing process by port:', error);
        res.status(500).json({ success: false, message: 'Failed to kill process' });
    }
});

// API endpoint to get tmux pane history
router.get('/:sessionId/history', (req, res) => {
    const sessionId = req.params.sessionId;
    const lines = req.query.lines || '100000'; // Default to 100k lines
    
    try {
        // Capture pane history from tmux
        const history = execSync(`tmux capture-pane -p -S -${lines} -t ${sessionId}`, { encoding: 'utf8' });
        res.json({ success: true, history });
    } catch (error) {
        console.error('Error capturing tmux history:', error);
        res.status(404).json({ success: false, error: 'Session not found or failed to capture history' });
    }
});

module.exports = router;