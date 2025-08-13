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
        const NUM_STATUS_LINES = 6; // keep it aligned with UI clamp
        let status = 'No output';
        if (lines.length > 0) {
            const lastLines = lines.slice(-NUM_STATUS_LINES);
            status = lastLines.join('\n').trim() || 'Active session';
        }
        
        allSessions.push({
            id: sessionID,
            status,
            created: session.created || new Date().toISOString(),
            projectName: session.projectName || 'Unknown'
        });
    });
    res.json(allSessions);
});



// API endpoint to kill a session (dtach-aware)
router.delete('/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    const { getSessions, deleteSession } = require('../websocket/terminal');
    const sessions = getSessions();
    const session = sessions.get(sessionId);

    if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found' });
    }

    try {
        deleteSession(sessionId);
        return res.json({ success: true, message: 'Session killed successfully' });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;