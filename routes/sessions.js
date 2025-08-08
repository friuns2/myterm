const express = require('express');

const router = express.Router();

// API endpoint to get all sessions across all projects
router.get('/', (req, res) => {
    const { getSessions } = require('../websocket/terminal');
    const sessions = getSessions();
    
    const allSessions = [];
    sessions.forEach((session, sessionID) => {
        // Get last line from buffer for status
        const lines = session.buffer.split('\n');
        const lastLine = lines[lines.length - 1] || lines[lines.length - 2] || 'No output';
        
        allSessions.push({
            id: sessionID,
            status: lastLine.trim() || 'Active session',
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