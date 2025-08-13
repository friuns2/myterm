const express = require('express');

const router = express.Router();

// API endpoint to get all sessions across all projects
router.get('/', (req, res) => {
    const { getSessions, listAbducoSessions, getAllSessionsInfo } = require('../websocket/terminal');
    const wsSessions = getSessions();
    const abduco = listAbducoSessions();
    const info = getAllSessionsInfo();
    const result = [];
    const NUM_STATUS_LINES = 6;
    const statusFor = (buf) => {
        const lines = (buf || '').split('\n');
        if (lines.length === 0) return 'No output';
        const lastLines = lines.slice(-NUM_STATUS_LINES);
        return lastLines.join('\n').trim() || 'Active session';
    };
    abduco.forEach(s => {
        const wsEntry = wsSessions.get(s.id);
        const meta = info[s.id] || {};
        result.push({
            id: s.id,
            status: statusFor(wsEntry ? wsEntry.buffer : ''),
            created: (wsEntry && wsEntry.created) || meta.created || new Date().toISOString(),
            projectName: (wsEntry && wsEntry.projectName) || meta.projectName || 'Unknown'
        });
    });
    res.json(result);
});



// API endpoint to kill a session
router.delete('/:sessionId', async (req, res) => {
    const sessionId = req.params.sessionId;
    const { deleteSession } = require('../websocket/terminal');
    const ok = await deleteSession(sessionId);
    if (ok) res.json({ success: true, message: 'Session terminated' });
    else res.status(404).json({ success: false, message: 'Session not found or still running' });
});

module.exports = router;