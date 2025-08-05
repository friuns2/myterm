const pty = require('node-pty');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

class SessionManager {
    constructor() {
        this.sessions = new Map(); // Map to store sessionID -> { ptyProcess, ws, timeoutId, buffer }
        this.SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours
        this.MAX_BUFFER_SIZE = 0; // Maximum number of characters to buffer
    }

    createSession() {
        const sessionID = uuidv4();
        const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
        
        const ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-color',
            cols: 80,
            rows: 24,
            cwd: process.cwd(),
            env: process.env
        });

        const session = {
            ptyProcess,
            ws: null,
            timeoutId: null,
            buffer: '',
            created: new Date().toISOString()
        };

        this.sessions.set(sessionID, session);
        console.log(`New session created: ${sessionID}`);
        
        return { sessionID, session };
    }

    getSession(sessionID) {
        return this.sessions.get(sessionID);
    }

    hasSession(sessionID) {
        return this.sessions.has(sessionID);
    }

    updateSessionWebSocket(sessionID, ws) {
        const session = this.sessions.get(sessionID);
        if (session) {
            // Clear previous timeout for this session
            if (session.timeoutId) {
                clearTimeout(session.timeoutId);
                session.timeoutId = null;
            }
            // Update WebSocket instance
            session.ws = ws;
            return session;
        }
        return null;
    }

    addToBuffer(sessionID, data) {
        const session = this.sessions.get(sessionID);
        if (session) {
            // Add data to buffer
            session.buffer += data;
            
            // Trim buffer if it exceeds maximum size
            if (session.buffer.length > this.MAX_BUFFER_SIZE) {
                // Keep only the last MAX_BUFFER_SIZE characters
                session.buffer = session.buffer.slice(-this.MAX_BUFFER_SIZE);
            }
        }
    }

    getBuffer(sessionID) {
        const session = this.sessions.get(sessionID);
        return session ? session.buffer : '';
    }

    deleteSession(sessionID) {
        const session = this.sessions.get(sessionID);
        if (session) {
            if (session.timeoutId) {
                clearTimeout(session.timeoutId);
            }
            if (session.ptyProcess) {
                session.ptyProcess.kill();
            }
            this.sessions.delete(sessionID);
            console.log(`Session deleted: ${sessionID}`);
        }
    }

    setSessionTimeout(sessionID) {
        const session = this.sessions.get(sessionID);
        if (session) {
            session.timeoutId = setTimeout(() => {
                console.log(`Session ${sessionID} timed out. Killing process.`);
                this.deleteSession(sessionID);
            }, this.SESSION_TIMEOUT);
        }
    }

    getAllSessions() {
        const sessionList = [];
        this.sessions.forEach((session, sessionID) => {
            // Get last line from buffer for status
            const lines = session.buffer.split('\n');
            const lastLine = lines[lines.length - 1] || lines[lines.length - 2] || 'No output';
            
            sessionList.push({
                id: sessionID,
                status: lastLine.trim() || 'Active session',
                created: session.created || new Date().toISOString()
            });
        });
        return sessionList;
    }

    getSessionCount() {
        return this.sessions.size;
    }

    cleanup() {
        // Clean up all sessions
        this.sessions.forEach((session, sessionID) => {
            this.deleteSession(sessionID);
        });
    }
}

module.exports = SessionManager;