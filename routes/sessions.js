const express = require('express');
const path = require('path');
const { PROJECTS_DIR } = require('../middleware/security');

const router = express.Router();

// API endpoint to get all sessions across all projects
router.get('/', (req, res) => {
    const { getSessions } = require('../websocket/terminal');
    const sessions = getSessions();

    // Optional query param to return last N lines of status (defaults to 1)
    const linesParam = parseInt(req.query.lines, 10);
    const numLines = Number.isFinite(linesParam) ? Math.max(1, Math.min(linesParam, 20)) : 1;
    
    const allSessions = [];
    sessions.forEach((session, sessionID) => {
        // Get last N lines from buffer for status
        const rawLines = session.buffer.split('\n');
        // Remove trailing empty line if buffer ends with a newline
        while (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') {
            rawLines.pop();
        }
        const sliceStart = Math.max(0, rawLines.length - numLines);
        const lastLines = rawLines.slice(sliceStart).map(l => l.trim());
        const lastLine = lastLines[lastLines.length - 1] || 'No output';
        
        allSessions.push({
            id: sessionID,
            status: lastLine || 'Active session',
            statusLines: lastLines,
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