const express = require('express');

class ApiRoutes {
    constructor(sessionManager) {
        this.sessionManager = sessionManager;
        this.router = express.Router();
        this.setupRoutes();
    }

    setupRoutes() {
        // API endpoint to get session list
        this.router.get('/sessions', (req, res) => {
            try {
                const sessionList = this.sessionManager.getAllSessions();
                res.json(sessionList);
            } catch (error) {
                console.error('Error fetching sessions:', error);
                res.status(500).json({ error: 'Failed to fetch sessions' });
            }
        });

        // API endpoint to get session details
        this.router.get('/sessions/:sessionId', (req, res) => {
            try {
                const sessionId = req.params.sessionId;
                const session = this.sessionManager.getSession(sessionId);
                
                if (!session) {
                    return res.status(404).json({ error: 'Session not found' });
                }

                res.json({
                    id: sessionId,
                    created: session.created,
                    bufferSize: session.buffer.length,
                    isActive: session.ws && session.ws.readyState === 1
                });
            } catch (error) {
                console.error('Error fetching session details:', error);
                res.status(500).json({ error: 'Failed to fetch session details' });
            }
        });

        // API endpoint to delete a session
        this.router.delete('/sessions/:sessionId', (req, res) => {
            try {
                const sessionId = req.params.sessionId;
                const session = this.sessionManager.getSession(sessionId);
                
                if (!session) {
                    return res.status(404).json({ error: 'Session not found' });
                }

                this.sessionManager.deleteSession(sessionId);
                res.json({ message: 'Session deleted successfully' });
            } catch (error) {
                console.error('Error deleting session:', error);
                res.status(500).json({ error: 'Failed to delete session' });
            }
        });

        // API endpoint to get server statistics
        this.router.get('/stats', (req, res) => {
            try {
                res.json({
                    totalSessions: this.sessionManager.getSessionCount(),
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    platform: process.platform,
                    nodeVersion: process.version
                });
            } catch (error) {
                console.error('Error fetching stats:', error);
                res.status(500).json({ error: 'Failed to fetch stats' });
            }
        });

        // Health check endpoint
        this.router.get('/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });
    }

    getRouter() {
        return this.router;
    }
}

module.exports = ApiRoutes;