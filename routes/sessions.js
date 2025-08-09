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

    // Compose response with status captured from tmux active pane
    const NUM_STATUS_LINES = 6;
    const all = tmuxSessions.map(ts => {
        let status = 'No output';
        try {
            // Capture last ~200 lines, then trim to last NUM_STATUS_LINES to keep payload small
            const captured = execSync(`tmux capture-pane -p -J -t ${ts.name}: -S -200`, { encoding: 'utf8' });
            const lines = (captured || '').split('\n');
            const last = lines.slice(-NUM_STATUS_LINES).join('\n').trim();
            if (last) status = last;
        } catch (e) {
            status = 'Unavailable';
        }

        // Derive project name from our tmux naming convention: msh-<id>-<project>
        let projectName = 'Unknown';
        try {
            const prefix = 'msh-';
            if (ts.name && ts.name.startsWith(prefix)) {
                const tail = ts.name.slice(prefix.length);
                const firstDash = tail.indexOf('-');
                if (firstDash !== -1) {
                    projectName = tail.slice(firstDash + 1) || 'Unknown';
                }
            }
        } catch (_) {}

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