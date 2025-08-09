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

    const { getSessions } = require('../websocket/terminal');
    const attachClients = getSessions();

    const NUM_STATUS_LINES = 6;
    const all = tmuxSessions.map(ts => {
        const attach = attachClients.get(ts.name);
        let status = 'Detached';
        if (attach && attach.buffer) {
            const lines = attach.buffer.split('\n');
            const lastLines = lines.slice(-NUM_STATUS_LINES);
            status = lastLines.join('\n').trim() || 'Attached';
        }
        return {
            id: ts.name,
            status,
            created: ts.createdStr || new Date().toISOString(),
            projectName: (attach && attach.projectName) || 'Unknown'
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