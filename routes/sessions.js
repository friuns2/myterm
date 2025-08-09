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

    // Use tmux sessions as the source of truth. Fetch last 3 lines from pane for status.
    const all = tmuxSessions.map(ts => {
        // Infer project name from msh-<id>-<project>
        let projectName = 'Unknown';
        const match = ts.name && ts.name.match(/^msh-[0-9a-f]{8}-(.+)$/i);
        if (match) {
            projectName = match[1];
        }

        let status = 'No output';
        try {
            const captured = execSync(`tmux capture-pane -p -J -S -200 -t ${ts.name}:`, {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore']
            });
            if (captured && typeof captured === 'string') {
                const lines = captured.split('\n');
                const lastLines = lines.slice(-3);
                const joined = lastLines.join('\n').trim();
                if (joined) status = joined;
            }
        } catch (_) {
            // ignore errors
        }

        return {
            id: ts.name,
            status,
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