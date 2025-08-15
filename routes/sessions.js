const express = require('express');
const path = require('path');
const { PROJECTS_DIR } = require('../middleware/security');
const { execSync } = require('child_process');

const router = express.Router();

// Function to detect ports used by processes in tmux session
function detectSessionPorts(sessionName) {
    const ports = [];
    try {
        // Get all panes in the session with their TTYs
        const panesOutput = execSync(`tmux list-panes -s -t ${JSON.stringify(sessionName)} -F "#{pane_id} #{pane_tty}" 2>/dev/null || true`, { encoding: 'utf8' });
        const panes = panesOutput.split('\n').filter(Boolean);
        
        for (const pane of panes) {
            const [paneId, tty] = pane.split(' ');
            if (!tty) continue;
            
            try {
                // Extract TTY device name (e.g., ttys007 from /dev/ttys007)
                const ttyDevice = tty.replace('/dev/', '');
                
                // Get processes running on this TTY
                const psOutput = execSync(`ps -ft ${ttyDevice} 2>/dev/null || true`, { encoding: 'utf8' });
                const lines = psOutput.split('\n').filter(line => line.trim() && !line.includes('PID'));
                
                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 2) {
                        const pid = parts[1];
                        if (pid && /^\d+$/.test(pid)) {
                            // Collect this process and its children (depth 2)
                            const pidsToCheck = [pid];
                            
                            try {
                                // Get child processes (depth 1)
                                const childrenOutput = execSync(`pgrep -P ${pid} 2>/dev/null || true`, { encoding: 'utf8' });
                                const childPids = childrenOutput.split('\n').filter(p => p.trim() && /^\d+$/.test(p.trim()));
                                pidsToCheck.push(...childPids);
                                
                                // Get grandchildren processes (depth 2)
                                for (const childPid of childPids) {
                                    try {
                                        const grandchildrenOutput = execSync(`pgrep -P ${childPid} 2>/dev/null || true`, { encoding: 'utf8' });
                                        const grandchildPids = grandchildrenOutput.split('\n').filter(p => p.trim() && /^\d+$/.test(p.trim()));
                                        pidsToCheck.push(...grandchildPids);
                                    } catch (_) {
                                        // Ignore errors for individual grandchildren lookup
                                    }
                                }
                            } catch (_) {
                                // Ignore errors for children lookup, still check the parent process
                            }
                            
                            // Check ports for all collected PIDs
                            for (const pidToCheck of pidsToCheck) {
                                try {
                                    // Check what ports this process is using
                                    const lsofOutput = execSync(`lsof -Pan -p ${pidToCheck} -i 2>/dev/null || true`, { encoding: 'utf8' });
                                    const lsofLines = lsofOutput.split('\n').filter(Boolean);
                                    
                                    for (const lsofLine of lsofLines) {
                                        const match = lsofLine.match(/:([0-9]+)\s*\(LISTEN\)/);
                                        if (match) {
                                            const port = parseInt(match[1]);
                                            if (port && !ports.includes(port)) {
                                                ports.push(port);
                                            }
                                        }
                                    }
                                } catch (_) {
                                    // Ignore lsof errors for individual processes
                                }
                            }
                        }
                    }
                }
            } catch (_) {
                // Ignore errors for individual panes
            }
        }
    } catch (_) {
        // Ignore errors for the entire session
    }
    
    return ports.sort((a, b) => a - b);
}

// API endpoint to get all sessions across all projects
router.get('/', (req, res) => {
    // Source of truth: list tmux sessions; augment with in-memory attach clients if any
    let tmuxSessions = [];
    try {
        const out = execSync('tmux list-sessions -F "#{session_name}|#{session_created_string}|#{session_path}" 2>/dev/null || true', { encoding: 'utf8' });
        tmuxSessions = out
            .split('\n')
            .filter(Boolean)
            .map(line => {
                const [name, createdStr, pathStr] = line.split('|');
                return { name, createdStr, pathStr };
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

		// Detect ports used by this session
		const ports = detectSessionPorts(ts.name);

		return {
			id: ts.name,
			path: ts.pathStr || '',
			thumbnail: thumbnail || '',
			lastCommitSubject,
			lastCommitShortHash,
			created: ts.createdStr || new Date().toISOString(),
			projectName,
			ports
		};
    });

    res.json(all);
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

module.exports = router;