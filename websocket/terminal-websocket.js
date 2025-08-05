// WebSocket server for terminal sessions
const WebSocket = require('ws');
const pty = require('node-pty');
const path = require('path');
const { PROJECTS_DIR, isSafePath } = require('../routes/projects');

// Store active sessions
const sessions = new Map();

// Session cleanup interval (5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;

// Helper function to generate session ID
function generateSessionId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Helper function to get project path
function getProjectPath(projectName) {
    if (!isSafePath(projectName)) {
        throw new Error('Invalid project name');
    }
    return path.join(PROJECTS_DIR, projectName);
}

// Session management functions
function createSession(projectName, sessionId = null) {
    try {
        const projectPath = getProjectPath(projectName);
        const id = sessionId || generateSessionId();
        
        // Create PTY process
        const ptyProcess = pty.spawn('bash', [], {
            name: 'xterm-color',
            cols: 80,
            rows: 24,
            cwd: projectPath,
            env: {
                ...process.env,
                TERM: 'xterm-256color',
                COLORTERM: 'truecolor'
            }
        });
        
        const session = {
            id,
            projectName,
            ptyProcess,
            clients: new Set(),
            lastActivity: Date.now(),
            created: Date.now(),
            cols: 80,
            rows: 24
        };
        
        // Handle PTY data
        ptyProcess.on('data', (data) => {
            session.lastActivity = Date.now();
            // Broadcast to all connected clients
            session.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'output',
                        data: data
                    }));
                }
            });
        });
        
        // Handle PTY exit
        ptyProcess.on('exit', (code, signal) => {
            console.log(`Session ${id} exited with code ${code}, signal ${signal}`);
            
            // Notify all clients
            session.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'exit',
                        code,
                        signal
                    }));
                }
            });
            
            // Clean up session
            sessions.delete(id);
        });
        
        sessions.set(id, session);
        console.log(`Created session ${id} for project ${projectName}`);
        
        return session;
        
    } catch (error) {
        console.error('Error creating session:', error);
        throw error;
    }
}

function getSession(sessionId) {
    return sessions.get(sessionId);
}

function killSession(sessionId) {
    const session = sessions.get(sessionId);
    if (session) {
        try {
            session.ptyProcess.kill();
            sessions.delete(sessionId);
            console.log(`Killed session ${sessionId}`);
            return true;
        } catch (error) {
            console.error(`Error killing session ${sessionId}:`, error);
            return false;
        }
    }
    return false;
}

function getProjectSessions(projectName) {
    const projectSessions = [];
    sessions.forEach((session, id) => {
        if (session.projectName === projectName) {
            projectSessions.push({
                id,
                projectName: session.projectName,
                created: session.created,
                lastActivity: session.lastActivity,
                clientCount: session.clients.size,
                cols: session.cols,
                rows: session.rows
            });
        }
    });
    return projectSessions;
}

function getAllSessions() {
    const allSessions = [];
    sessions.forEach((session, id) => {
        allSessions.push({
            id,
            projectName: session.projectName,
            created: session.created,
            lastActivity: session.lastActivity,
            clientCount: session.clients.size,
            cols: session.cols,
            rows: session.rows
        });
    });
    return allSessions;
}

// WebSocket connection handler
function handleWebSocketConnection(ws, req) {
    console.log('New WebSocket connection');
    
    let currentSession = null;
    
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'connect':
                    const { projectName, sessionId } = data;
                    
                    if (!projectName) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Project name is required'
                        }));
                        return;
                    }
                    
                    try {
                        // Try to reconnect to existing session or create new one
                        let session;
                        if (sessionId) {
                            session = getSession(sessionId);
                            if (!session || session.projectName !== projectName) {
                                // Session doesn't exist or belongs to different project
                                session = createSession(projectName);
                            }
                        } else {
                            session = createSession(projectName);
                        }
                        
                        currentSession = session;
                        session.clients.add(ws);
                        session.lastActivity = Date.now();
                        
                        // Send session ID to client
                        ws.send(JSON.stringify({
                            type: 'session_id',
                            sessionId: session.id
                        }));
                        
                        console.log(`Client connected to session ${session.id}`);
                        
                    } catch (error) {
                        console.error('Error connecting to session:', error);
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Failed to connect to session'
                        }));
                    }
                    break;
                    
                case 'input':
                    if (currentSession && currentSession.ptyProcess) {
                        currentSession.ptyProcess.write(data.data);
                        currentSession.lastActivity = Date.now();
                    }
                    break;
                    
                case 'resize':
                    if (currentSession && currentSession.ptyProcess) {
                        const { cols, rows } = data;
                        if (cols && rows) {
                            currentSession.ptyProcess.resize(cols, rows);
                            currentSession.cols = cols;
                            currentSession.rows = rows;
                            currentSession.lastActivity = Date.now();
                        }
                    }
                    break;
                    
                default:
                    console.log('Unknown message type:', data.type);
            }
            
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format'
            }));
        }
    });
    
    ws.on('close', () => {
        console.log('WebSocket connection closed');
        if (currentSession) {
            currentSession.clients.delete(ws);
            console.log(`Client disconnected from session ${currentSession.id}`);
        }
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        if (currentSession) {
            currentSession.clients.delete(ws);
        }
    });
}

// Cleanup inactive sessions
function cleanupInactiveSessions() {
    const now = Date.now();
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutes
    
    sessions.forEach((session, id) => {
        if (session.clients.size === 0 && (now - session.lastActivity) > inactiveThreshold) {
            console.log(`Cleaning up inactive session ${id}`);
            killSession(id);
        }
    });
}

// Start cleanup interval
setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down WebSocket server...');
    sessions.forEach((session, id) => {
        killSession(id);
    });
});

module.exports = {
    handleWebSocketConnection,
    createSession,
    getSession,
    killSession,
    getProjectSessions,
    getAllSessions,
    sessions
};