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
const MAX_BUFFER_SIZE = 100 * 1024; // Maximum number of characters to buffer (10kb)

function setupWebSocketServer(server) {
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws, req) => {
        console.log('Terminal connected');
        
        // Parse session ID and project name from query parameters
        const url = new URL(req.url, `http://${req.headers.host}`);
        let sessionID = url.searchParams.get('sessionID');
        const projectName = url.searchParams.get('projectName');
        let ptyProcess;

        function spawnAbducoAttached(targetSessionID, cwd, cols = 80, rows = 24) {
            // Use abduco to manage the session lifecycle; -A attaches or creates
            const args = ['-A', targetSessionID, os.platform() === 'win32' ? 'powershell.exe' : 'zsh'];
            const mergedEnv = process.env;
            return pty.spawn('abduco', args, {
                name: 'xterm-color',
                cols,
                rows,
                cwd,
                env: mergedEnv
            });
        }

        function attachPtyHandlers(currentSessionID, currentWs) {
            const currentSession = sessions.get(currentSessionID);
            if (!currentSession || !currentSession.ptyProcess) return;
            const processRef = currentSession.ptyProcess;

            processRef.onData((data) => {
                const s = sessions.get(currentSessionID);
                if (!s) return;
                s.buffer += data;
                if (s.buffer.length > MAX_BUFFER_SIZE) {
                    s.buffer = s.buffer.slice(-MAX_BUFFER_SIZE);
                }
                if (s.ws && s.ws.readyState === WebSocket.OPEN) {
                    try {
                        s.ws.send(JSON.stringify({ type: 'output', data }));
                    } catch (error) {
                        console.error(`Error sending data to session ${currentSessionID}:`, error);
                    }
                }
            });

            processRef.onExit(({ exitCode, signal }) => {
                console.log(`Attached client for ${currentSessionID} exited with code: ${exitCode}, signal: ${signal}`);
                const s = sessions.get(currentSessionID);
                if (s) {
                    // Do not delete abduco session here; only clear the client PTY reference
                    s.ptyProcess = null;
                    // Notify connected client if still open
                    if (s.ws && s.ws.readyState === WebSocket.OPEN) {
                        try {
                            s.ws.send(JSON.stringify({ type: 'exit', exitCode, signal }));
                        } catch (error) {
                            console.error(`Error sending exit message to session ${currentSessionID}:`, error);
                        }
                    }
                }
            });
        }

        if (sessionID && sessions.has(sessionID)) {
            // Reconnect to existing session: re-attach via abduco
            const session = sessions.get(sessionID);
            // Clear previous timeout for this session
            if (session.timeoutId) {
                clearTimeout(session.timeoutId);
                session.timeoutId = null;
            }
            // Close any existing WebSocket connection for this session
            if (session.ws && session.ws !== ws && session.ws.readyState === WebSocket.OPEN) {
                console.log(`Closing previous WebSocket connection for session: ${sessionID}`);
                session.ws.close(1000, 'New connection established');
            }
            // Kill any stale PTY client
            if (session.ptyProcess && !session.ptyProcess.killed) {
                try { session.ptyProcess.kill(); } catch (_) {}
            }
            // Determine working directory for project
            let cwd = process.cwd();
            if (session.projectName) {
                const projectPath = path.join(PROJECTS_DIR, session.projectName);
                if (fs.existsSync(projectPath)) {
                    cwd = projectPath;
                }
            }
            ptyProcess = spawnAbducoAttached(sessionID, cwd, 80, 24);
            session.ptyProcess = ptyProcess;
            session.ws = ws;
            console.log(`Reconnected to session: ${sessionID}`);
            // Send buffered content to reconnecting client
            if (session.buffer && session.buffer.length > 0) {
                ws.send(JSON.stringify({ type: 'output', data: session.buffer }));
                console.log(`Sent ${session.buffer.length} characters from buffer`);
            }
            attachPtyHandlers(sessionID, ws);
            // Also resend sessionID to client to ensure it persists in URL
            ws.send(JSON.stringify({ type: 'sessionID', sessionID }));
        } else if (!sessionID && projectName) {
            // Create or attach abduco session for a specific project
            sessionID = uuidv4();
            // Determine working directory
            let cwd = process.cwd();
            if (projectName) {
                const projectPath = path.join(PROJECTS_DIR, projectName);
                if (fs.existsSync(projectPath)) {
                    cwd = projectPath;
                } else {
                    fs.mkdirSync(projectPath, { recursive: true });
                    cwd = projectPath;
                }
            }
            ptyProcess = spawnAbducoAttached(sessionID, cwd, 80, 24);
            const session = { ptyProcess, ws, timeoutId: null, buffer: '', created: new Date().toISOString(), projectName: projectName || null };
            sessions.set(sessionID, session);
            console.log(`New session created (abduco): ${sessionID} for project: ${projectName || 'default'}`);
            // Send session ID to client
            ws.send(JSON.stringify({ type: 'sessionID', sessionID }));
            // Attach PTY handlers
            attachPtyHandlers(sessionID, ws);
        } else {
            // Do NOT auto-create sessions when no valid sessionID is provided and no project is specified
            // Send an error to the client and close the connection
            try {
                let message = 'Missing sessionID in query string';
                if (sessionID && !sessions.has(sessionID)) {
                    message = `Session not found: ${sessionID}`;
                }
                ws.send(JSON.stringify({ type: 'error', message }));
            } catch (e) {
                // ignore send errors
            }
            ws.close(1008, 'Invalid session');
            return;
        }

        // Handle WebSocket messages
        ws.on('message', (message) => {
            try {
                const msg = JSON.parse(message);

                // Validate that this WebSocket is still the active one for this session
                const currentSession = sessions.get(sessionID);
                if (!currentSession || currentSession.ws !== ws) {
                    console.warn(`Received message from inactive WebSocket for session ${sessionID}`);
                    return;
                }

                switch (msg.type) {
                    case 'input':
                        // Send input to PTY
                        if (currentSession.ptyProcess && !currentSession.ptyProcess.killed) {
                            currentSession.ptyProcess.write(msg.data);
                        }
                        break;

                    case 'resize':
                        // Resize PTY
                        if (currentSession.ptyProcess && !currentSession.ptyProcess.killed) {
                            currentSession.ptyProcess.resize(msg.cols, msg.rows);
                        }
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
            console.log(`Terminal disconnected for session: ${sessionID}`);
            const session = sessions.get(sessionID);
            if (session && session.ws === ws) {
                // Kill the abduco client PTY, but do NOT kill the underlying abduco-managed shell
                if (session.ptyProcess && !session.ptyProcess.killed) {
                    try { session.ptyProcess.kill(); } catch (_) {}
                    session.ptyProcess = null;
                }
                // Schedule garbage collection of the in-memory session metadata
                session.timeoutId = setTimeout(() => {
                    console.log(`Session ${sessionID} metadata timed out. Removing from memory.`);
                    sessions.delete(sessionID);
                }, SESSION_TIMEOUT);
            }
        });

        // Handle WebSocket errors
        ws.on('error', (error) => {
            console.error(`WebSocket error for session ${sessionID}:`, error);
            const session = sessions.get(sessionID);
            if (session && session.ws === ws) {
                // Ensure abduco client PTY is cleaned up
                if (session.ptyProcess && !session.ptyProcess.killed) {
                    try { session.ptyProcess.kill(); } catch (_) {}
                    session.ptyProcess = null;
                }
                // Only set timeout for metadata cleanup
                session.timeoutId = setTimeout(() => {
                    console.log(`Session ${sessionID} metadata timed out due to error. Removing from memory.`);
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
    const session = sessions.get(sessionId);
    if (session) {
        if (session.timeoutId) {
            clearTimeout(session.timeoutId);
        }
        if (session.ws && session.ws.readyState === WebSocket.OPEN) {
            try { session.ws.close(); } catch (_) {}
        }
        if (session.ptyProcess && !session.ptyProcess.killed) {
            try { session.ptyProcess.kill(); } catch (_) {}
            session.ptyProcess = null;
        }
    }
    // Attempt to terminate the abduco-managed shell by attaching and exiting
    try {
        const cwd = session && session.projectName ? (fs.existsSync(path.join(PROJECTS_DIR, session.projectName)) ? path.join(PROJECTS_DIR, session.projectName) : process.cwd()) : process.cwd();
        const tmpClient = pty.spawn('abduco', ['-a', sessionId], { name: 'xterm-color', cols: 80, rows: 24, cwd, env: process.env });
        // Give it a moment to attach, then send exit
        setTimeout(() => {
            try { tmpClient.write('exit\n'); } catch (_) {}
            setTimeout(() => { try { tmpClient.kill(); } catch (_) {} }, 300);
        }, 200);
    } catch (e) {
        // ignore errors while attempting to kill abduco session
    }
    sessions.delete(sessionId);
}

module.exports = {
    setupWebSocketServer,
    getSessions,
    deleteSession
};