const express = require('express');
const path = require('path');
const { PROJECTS_DIR } = require('../middleware/security');
const { execSync } = require('child_process');

const router = express.Router();

// API endpoint to get all sessions across all projects
router.get('/', (req, res) => {
    // Source of truth: list tmux sessions; augment with in-memory attach clients if any
    let tmuxSessions = [];
    try {
        const out = execSync('tmux list-sessions -F "#{session_name}|#{session_created_string}|#{session_path}"', { encoding: 'utf8' });
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
        let status = '';
        let thumbnail = '';
        let lastCommitSubject = '';
        let lastCommitShortHash = '';
        try {
            const safeName = JSON.stringify(ts.name).slice(1, -1); // safely quoted tmux target
            // Capture visible pane with ANSI for thumbnail
            const thumbCmd = `tmux capture-pane -pet ${safeName}`; // -p print, -e include escapes, -t target
            thumbnail = execSync(thumbCmd, { encoding: 'utf8' });

            // Also build legacy short status text (ANSI stripped, collapsed)
            const cmd = `tmux capture-pane -pt ${safeName} -S -200 || true`;
            const out = execSync(cmd, { encoding: 'utf8' });
            const ansiRegex = /\x1B\[[0-9;?]*[ -\/]*[@-~]/g; // strip ANSI CSI sequences
            let cleaned = (out || '').replace(ansiRegex, '');
            // Keep only printable ASCII; drop control chars
            cleaned = cleaned.replace(/[^\x20-\x7E\n\r\t]/g, '');
            // Remove newlines/tabs and collapse whitespace
            cleaned = cleaned.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
            // Return only last 200 characters
            status = cleaned.length > 500 ? cleaned.slice(-500) : cleaned;
        } catch (_) {
            status = '';
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

        // Try to infer project name from our tmux naming scheme: msh-<id>-<project>
        let projectName = 'Unknown';
        const parts = ts.name.split('-');
        if (parts[0] === 'msh' && parts.length >= 3) {
            projectName = parts.slice(2).join('-');
        }

        return {
            id: ts.name,
            status: status || 'No output',
            thumbnail: thumbnail || '',
            lastCommitSubject,
            lastCommitShortHash,
            created: ts.createdStr || new Date().toISOString(),
            projectName
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

module.exports = router;