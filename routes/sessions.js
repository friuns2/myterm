const express = require('express');
const path = require('path');
const { execFile } = require('child_process');
const { PROJECTS_DIR } = require('../middleware/security');

const router = express.Router();

// API endpoint to get all sessions across all projects (merge in-memory + abduco list)
router.get('/', (req, res) => {
    const { getSessions } = require('../websocket/terminal');
    const sessions = getSessions();

    const allSessions = [];
    const seen = new Set();

    // In-memory sessions (with buffered status)
    sessions.forEach((session, sessionID) => {
        const lines = session.buffer.split('\n');
        const NUM_STATUS_LINES = 6;
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
        seen.add(sessionID);
    });

    // Also include abduco-listed sessions
    execFile('abduco', ['-l'], { timeout: 2000 }, (err, stdout) => {
        if (!err && stdout) {
            const lines = stdout.split('\n');
            for (const line of lines) {
                // Example: "  Wed    2025-08-13 09:42:34    mysession"
                const m = line.match(/\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+(.+)$/);
                if (m) {
                    const createdStr = m[1];
                    const name = m[2].trim();
                    if (!seen.has(name)) {
                        // Try to parse date, fallback to now
                        let created = new Date(createdStr);
                        if (isNaN(created.getTime())) {
                            created = new Date();
                        }
                        allSessions.push({
                            id: name,
                            status: 'Detached session (abduco)',
                            created: created.toISOString(),
                            projectName: 'Unknown'
                        });
                        seen.add(name);
                    }
                }
            }
        }
        res.json(allSessions);
    });
});



// API endpoint to kill a session (abduco-aware)
router.delete('/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    const { deleteSession } = require('../websocket/terminal');
    try {
        deleteSession(sessionId);
        res.json({ success: true, message: 'Session termination requested' });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to terminate session' });
    }
});

module.exports = router;