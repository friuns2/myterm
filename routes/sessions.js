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

    // Build response using tmux capture-pane + filter pipeline for recent status
    const all = tmuxSessions.map(ts => {
        let status = '';
        try {
            const safeName = JSON.stringify(ts.name).slice(1, -1); // safely quoted tmux target
            const cmd = `tmux capture-pane -pt ${safeName} | grep -vE '^(╭|╰|│|─{5,})|^$' | tail -n 3 || true`;
            const out = execSync(cmd, { encoding: 'utf8' });
            status = (out || '').trim();
        } catch (_) {
            status = '';
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