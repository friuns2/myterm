// Terminal session management routes
const express = require('express');
const { PROJECTS_DIR, isSafePath } = require('./projects');

const router = express.Router({ mergeParams: true });

// This will be injected by the main server
let activeSessions = null;

// Initialize with sessions reference
function initializeSessions(sessionsRef) {
    activeSessions = sessionsRef;
}

// Get all active sessions for a project
router.get('/', async (req, res) => {
    try {
        const { projectName } = req.params;
        
        if (!isSafePath(projectName)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (!activeSessions) {
            return res.status(500).json({ error: 'Sessions not initialized' });
        }
        
        // Filter sessions by project
        const projectSessions = [];
        for (const [sessionId, session] of activeSessions.entries()) {
            if (session.projectName === projectName) {
                projectSessions.push({
                    id: sessionId,
                    pid: session.ptyProcess ? session.ptyProcess.pid : null,
                    created: session.created || new Date(),
                    projectName: session.projectName,
                    cwd: session.cwd || null
                });
            }
        }
        
        res.json(projectSessions);
        
    } catch (error) {
        console.error('Error getting sessions:', error);
        res.status(500).json({ error: 'Failed to get sessions' });
    }
});

// Get specific session details
router.get('/:sessionId', async (req, res) => {
    try {
        const { projectName, sessionId } = req.params;
        
        if (!isSafePath(projectName)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (!activeSessions) {
            return res.status(500).json({ error: 'Sessions not initialized' });
        }
        
        const session = activeSessions.get(sessionId);
        if (!session || session.projectName !== projectName) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        res.json({
            id: sessionId,
            pid: session.ptyProcess ? session.ptyProcess.pid : null,
            created: session.created || new Date(),
            projectName: session.projectName,
            cwd: session.cwd || null,
            isActive: session.ptyProcess && !session.ptyProcess.killed
        });
        
    } catch (error) {
        console.error('Error getting session details:', error);
        res.status(500).json({ error: 'Failed to get session details' });
    }
});

// Kill a specific session
router.delete('/:sessionId', async (req, res) => {
    try {
        const { projectName, sessionId } = req.params;
        
        if (!isSafePath(projectName)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (!activeSessions) {
            return res.status(500).json({ error: 'Sessions not initialized' });
        }
        
        const session = activeSessions.get(sessionId);
        if (!session || session.projectName !== projectName) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        try {
            // Kill the PTY process if it exists
            if (session.ptyProcess && !session.ptyProcess.killed) {
                session.ptyProcess.kill('SIGTERM');
                
                // Force kill after 5 seconds if still running
                setTimeout(() => {
                    if (session.ptyProcess && !session.ptyProcess.killed) {
                        session.ptyProcess.kill('SIGKILL');
                    }
                }, 5000);
            }
            
            // Close WebSocket if it exists
            if (session.ws && session.ws.readyState === session.ws.OPEN) {
                session.ws.close();
            }
            
            // Remove session from active sessions
            activeSessions.delete(sessionId);
            
            res.json({
                message: 'Session killed successfully',
                sessionId
            });
            
        } catch (killError) {
            console.error('Error killing session:', killError);
            res.status(500).json({ error: 'Failed to kill session' });
        }
        
    } catch (error) {
        console.error('Error killing session:', error);
        res.status(500).json({ error: 'Failed to kill session' });
    }
});

// Kill all sessions for a project
router.delete('/', async (req, res) => {
    try {
        const { projectName } = req.params;
        
        if (!isSafePath(projectName)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (!activeSessions) {
            return res.status(500).json({ error: 'Sessions not initialized' });
        }
        
        const killedSessions = [];
        
        // Find and kill all sessions for this project
        for (const [sessionId, session] of activeSessions.entries()) {
            if (session.projectName === projectName) {
                try {
                    // Kill the PTY process if it exists
                    if (session.ptyProcess && !session.ptyProcess.killed) {
                        session.ptyProcess.kill('SIGTERM');
                    }
                    
                    // Close WebSocket if it exists
                    if (session.ws && session.ws.readyState === session.ws.OPEN) {
                        session.ws.close();
                    }
                    
                    killedSessions.push(sessionId);
                } catch (killError) {
                    console.error(`Error killing session ${sessionId}:`, killError);
                }
                
                // Remove session from active sessions
                activeSessions.delete(sessionId);
            }
        }
        
        res.json({
            message: `Killed ${killedSessions.length} sessions`,
            killedSessions
        });
        
    } catch (error) {
        console.error('Error killing all sessions:', error);
        res.status(500).json({ error: 'Failed to kill sessions' });
    }
});

// Get session statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const { projectName } = req.params;
        
        if (!isSafePath(projectName)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (!activeSessions) {
            return res.status(500).json({ error: 'Sessions not initialized' });
        }
        
        let totalSessions = 0;
        let activeSessions = 0;
        
        for (const [sessionId, session] of activeSessions.entries()) {
            if (session.projectName === projectName) {
                totalSessions++;
                if (session.ptyProcess && !session.ptyProcess.killed) {
                    activeSessions++;
                }
            }
        }
        
        res.json({
            projectName,
            totalSessions,
            activeSessions,
            inactiveSessions: totalSessions - activeSessions
        });
        
    } catch (error) {
        console.error('Error getting session stats:', error);
        res.status(500).json({ error: 'Failed to get session statistics' });
    }
});

module.exports = router;
module.exports.initializeSessions = initializeSessions;