const express = require('express');
const path = require('path');
const { PROJECTS_DIR } = require('../middleware/security');
const { execSync } = require('child_process');

const router = express.Router();

// API endpoint to get all sessions across all projects
router.get('/', (req, res) => {
    // Source of truth: tmux
    let tmuxSessions = [];
    try {
        const fmt = [
            '#{session_name}',
            '#{session_created_string}',
            '#{session_path}',
            '#{session_attached}',
            '#{session_windows}',
            '#{session_last_attached}',
            '#{session_activity}'
        ].join('|');
        const out = execSync(`tmux list-sessions -F "${fmt}"`, { encoding: 'utf8' });
        tmuxSessions = out
            .split('\n')
            .filter(Boolean)
            .map(line => {
                const [name, createdStr, pathStr, attachedStr, windowsStr, lastAttachedEpoch, activityEpoch] = line.split('|');
                const attachedClients = parseInt(attachedStr, 10) || 0;
                const windows = parseInt(windowsStr, 10) || 0;
                const lastAttached = lastAttachedEpoch ? new Date(parseInt(lastAttachedEpoch, 10) * 1000).toISOString() : null;
                const lastActivity = activityEpoch ? new Date(parseInt(activityEpoch, 10) * 1000).toISOString() : null;
                const status = attachedClients > 0 ? `Attached (${attachedClients})` : 'Detached';
                return {
                    id: name,
                    status,
                    created: createdStr || new Date().toISOString(),
                    projectName: 'Unknown',
                    path: pathStr,
                    attachedClients,
                    windows,
                    lastAttached,
                    lastActivity
                };
            });
    } catch (e) {
        tmuxSessions = [];
    }

    res.json(tmuxSessions);
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