const express = require('express');
const path = require('path');
const { PROJECTS_DIR } = require('../middleware/security');

const router = express.Router();

// API endpoint to get all sessions across all projects
router.get('/', (req, res) => {
    const { getSessions } = require('../websocket/terminal');
    const sessions = getSessions();
    
    const allSessions = [];
    sessions.forEach((session, sessionID) => {
        // Get last several lines from buffer for status (multiline)
        const lines = session.buffer.split('\n');
        const NUM_STATUS_LINES = 6; // short preview
        const rows = session.rows || 24;
        const cols = session.cols || 80;
        const NUM_SCREEN_LINES = rows; // full screen rows
        let status = 'No output';
        let screen = 'No output';
        if (lines.length > 0) {
            const lastStatusLines = lines.slice(-NUM_STATUS_LINES);
            status = lastStatusLines.join('\n').trim() || 'Active session';
            const lastScreenLines = lines.slice(-NUM_SCREEN_LINES);
            // Strip ANSI escape codes and normalize width to cols
            const ansiRegex = /\x1b\[[0-9;]*m/g;
            const normalized = lastScreenLines.map(l => {
                const noAnsi = (l || '').replace(ansiRegex, '');
                const cut = noAnsi.slice(0, cols);
                return cut.padEnd(cols, ' ');
            });
            screen = normalized.join('\n').trimEnd() || status;
        }
        
        allSessions.push({
            id: sessionID,
            status,
            screen,
            rows,
            cols,
            created: session.created || new Date().toISOString(),
            projectName: session.projectName || 'Unknown'
        });
    });
    res.json(allSessions);
});



// API endpoint to kill a session
router.delete('/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    const { getSessions, deleteSession } = require('../websocket/terminal');
    const sessions = getSessions();
    const session = sessions.get(sessionId);
    
    if (session) {
        // Kill the PTY process
        session.ptyProcess.kill();
        // Clear timeout if exists
        if (session.timeoutId) {
            clearTimeout(session.timeoutId);
        }
        // Remove from sessions map
        deleteSession(sessionId);
        res.json({ success: true, message: 'Session killed successfully' });
    } else {
        res.status(404).json({ success: false, message: 'Session not found' });
    }
});

module.exports = router;