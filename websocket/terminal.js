const WebSocket = require('ws');
const pty = require('node-pty');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { PROJECTS_DIR } = require('../middleware/security');

// Store active terminal sessions
const sessions = new Map(); // Map to store sessionID -> { ptyProcess, ws, timeoutId, buffer, projectName }
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000;
const MAX_BUFFER_SIZE = 9999999; // Maximum number of characters to buffer (0 = disabled)

function setupWebSocketServer(server) {
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws, req) => {
        console.log('Terminal connected');
        
        // Parse session ID and project name from query parameters
        const url = new URL(req.url, `http://${req.headers.host}`);
        let sessionID = url.searchParams.get('sessionID');
        const projectName = url.searchParams.get('projectName');
        let ptyProcess;

        if (sessionID && sessions.has(sessionID)) {
            // Reconnect to existing session
            const session = sessions.get(sessionID);
            ptyProcess = session.ptyProcess;
            // Clear previous timeout for this session
            clearTimeout(session.timeoutId);
            // Update WebSocket instance
            session.ws = ws;
            console.log(`Reconnected to session: ${sessionID}`);
            
            // Send buffered content to reconnecting client only if buffering is enabled
            if (MAX_BUFFER_SIZE > 0 && session.buffer && session.buffer.length > 0) {
                ws.send(JSON.stringify({
                    type: 'output',
                    data: session.buffer
                }));
                console.log(`Sent ${session.buffer.length} characters from buffer`);
            }
        } else {
            // Create new PTY process and session
            sessionID = uuidv4();
            const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
            
            // Determine working directory
            let cwd = process.cwd();
            if (projectName) {
                const projectPath = path.join(PROJECTS_DIR, projectName);
                if (fs.existsSync(projectPath)) {
                    cwd = projectPath;
                } else {
                    // Create project directory if it doesn't exist
                    fs.mkdirSync(projectPath, { recursive: true });
                    cwd = projectPath;
                }
            }
            
            ptyProcess = pty.spawn(shell, [], {
                name: 'xterm-color',
                cols: 80,
                rows: 24,
                cwd: cwd,
                env: process.env
            });

            const session = { ptyProcess, ws, timeoutId: null, buffer: '', created: new Date().toISOString(), projectName: projectName || null };
            sessions.set(sessionID, session);
            console.log(`New session created: ${sessionID} for project: ${projectName || 'default'}`);

            // Send session ID to client
            ws.send(JSON.stringify({
                type: 'sessionID',
                sessionID: sessionID
            }));

            // Set up PTY event handlers only for new sessions
            // Send PTY output to WebSocket and buffer it
            ptyProcess.onData((data) => {
                const currentSession = sessions.get(sessionID);
                if (currentSession) {
                    // Add data to buffer only if MAX_BUFFER_SIZE > 0
                    if (MAX_BUFFER_SIZE > 0) {
                        currentSession.buffer += data;
                        
                        // Trim buffer if it exceeds maximum size
                        if (currentSession.buffer.length > MAX_BUFFER_SIZE) {
                            // Keep only the last MAX_BUFFER_SIZE characters
                            currentSession.buffer = currentSession.buffer.slice(-MAX_BUFFER_SIZE);
                        }
                    }
                    
                    // Send data to connected client if WebSocket is open
                    if (currentSession.ws && currentSession.ws.readyState === WebSocket.OPEN) {
                        currentSession.ws.send(JSON.stringify({
                            type: 'output',
                            data: data
                        }));
                    }
                }
            });

            // Handle PTY exit
            ptyProcess.onExit(({ exitCode, signal }) => {
                console.log(`Process exited with code: ${exitCode}, signal: ${signal}`);
                const currentSession = sessions.get(sessionID);
                if (currentSession && currentSession.ws && currentSession.ws.readyState === WebSocket.OPEN) {
                    currentSession.ws.send(JSON.stringify({
                        type: 'exit',
                        exitCode,
                        signal
                    }));
                }
                sessions.delete(sessionID); // Clean up session on exit
            });
        }

        // Handle WebSocket messages
        ws.on('message', (message) => {
            try {
                const msg = JSON.parse(message);

                switch (msg.type) {
                    case 'input':
                        // Send input to PTY
                        ptyProcess.write(msg.data);
                        break;

                    case 'resize':
                        // Resize PTY
                        ptyProcess.resize(msg.cols, msg.rows);
                        break;

                    default:
                        console.log('Unknown message type:', msg.type);
                }
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        });

        // Clean up on WebSocket close
        ws.on('close', () => {
            console.log('Terminal disconnected');
            const session = sessions.get(sessionID);
            if (session) {
                session.timeoutId = setTimeout(() => {
                    console.log(`Session ${sessionID} timed out. Killing process.`);
                    session.ptyProcess.kill();
                    sessions.delete(sessionID);
                }, SESSION_TIMEOUT);
            }
        });

        // Handle WebSocket errors
        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            const session = sessions.get(sessionID);
            if (session) {
                session.timeoutId = setTimeout(() => {
                    console.log(`Session ${sessionID} timed out due to error. Killing process.`);
                    session.ptyProcess.kill();
                    sessions.delete(sessionID);
                }, SESSION_TIMEOUT);
            }
        });
    });

    return wss;
}

function getSessions() {
    return sessions;
}

function deleteSession(sessionId) {
    sessions.delete(sessionId);
}

module.exports = {
    setupWebSocketServer,
    getSessions,
    deleteSession
};