const WebSocket = require('ws');
const pty = require('node-pty');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { PROJECTS_DIR } = require('../middleware/security');
const { loadGlobalEnv } = require('../routes/environment');

// Store active terminal sessions
const sessions = new Map(); // Map to store sessionID -> { ptyProcess, ws, timeoutId, buffer, projectName }
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000;
const MAX_BUFFER_SIZE = 0; // Maximum number of characters to buffer

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
            if (session.timeoutId) {
                clearTimeout(session.timeoutId);
                session.timeoutId = null;
            }
            
            // Close any existing WebSocket connection for this session
            if (session.ws && session.ws !== ws && session.ws.readyState === WebSocket.OPEN) {
                console.log(`Closing previous WebSocket connection for session: ${sessionID}`);
                session.ws.close(1000, 'New connection established');
            }
            
            // Update WebSocket instance
            session.ws = ws;
            console.log(`Reconnected to session: ${sessionID}`);
            
            // Send buffered content to reconnecting client
            if (session.buffer && session.buffer.length > 0) {
                ws.send(JSON.stringify({
                    type: 'output',
                    data: session.buffer
                }));
                console.log(`Sent ${session.buffer.length} characters from buffer`);
            }
        } else {
            // Create new PTY process and session
            sessionID = uuidv4();
            const shell = os.platform() === 'win32' ? 'powershell.exe' : 'zsh';
            
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
            
            // Merge global environment variables with process.env
            const globalEnv = loadGlobalEnv();
            
            // Process global env to handle array values
            const processedGlobalEnv = {};
            for (const [key, value] of Object.entries(globalEnv)) {
                if (Array.isArray(value)) {
                    // For arrays, use the last value as the environment variable
                    processedGlobalEnv[key] = value[value.length - 1];
                } else {
                    processedGlobalEnv[key] = value;
                }
            }
            
            const mergedEnv = { ...process.env, ...processedGlobalEnv };
            
            ptyProcess = pty.spawn(shell, [], {
                name: 'xterm-color',
                cols: 80,
                rows: 24,
                cwd: cwd,
                env: mergedEnv
            });

            const session = { ptyProcess, ws, timeoutId: null, buffer: '', created: new Date().toISOString(), projectName: projectName || null };
            sessions.set(sessionID, session);
            console.log(`New session created: ${sessionID} for project: ${projectName || 'default'}`);

                // Wait a moment for shell to initialize, then add the alias
                setTimeout(() => {
                    const mshPath = path.join(cwd, 'msh.js');
                    ptyProcess.write(`alias msh="node ${mshPath}"\n`);
                }, 500);
            

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
                    // Add data to buffer
                    currentSession.buffer += data;
                    
                    // Trim buffer if it exceeds maximum size
                    if (currentSession.buffer.length > MAX_BUFFER_SIZE) {
                        // Keep only the last MAX_BUFFER_SIZE characters
                        currentSession.buffer = currentSession.buffer.slice(-MAX_BUFFER_SIZE);
                    }
                    
                    // Send data to connected client if WebSocket is open
                    if (currentSession.ws && currentSession.ws.readyState === WebSocket.OPEN) {
                        try {
                            currentSession.ws.send(JSON.stringify({
                                type: 'output',
                                data: data
                            }));
                        } catch (error) {
                            console.error(`Error sending data to session ${sessionID}:`, error);
                            // If there's an error sending, the WebSocket is likely closed
                            // Don't try to use it anymore
                            if (currentSession.ws.readyState !== WebSocket.OPEN) {
                                console.log(`WebSocket for session ${sessionID} is no longer open`);
                            }
                        }
                    }
                }
            });

            // Handle PTY exit
            ptyProcess.onExit(({ exitCode, signal }) => {
                console.log(`Process exited with code: ${exitCode}, signal: ${signal}`);
                const currentSession = sessions.get(sessionID);
                if (currentSession && currentSession.ws && currentSession.ws.readyState === WebSocket.OPEN) {
                    try {
                        currentSession.ws.send(JSON.stringify({
                            type: 'exit',
                            exitCode,
                            signal
                        }));
                    } catch (error) {
                        console.error(`Error sending exit message to session ${sessionID}:`, error);
                    }
                }
                sessions.delete(sessionID); // Clean up session on exit
            });
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
                        if (ptyProcess && !ptyProcess.killed) {
                            ptyProcess.write(msg.data);
                        }
                        break;

                    case 'resize':
                        // Resize PTY
                        if (ptyProcess && !ptyProcess.killed) {
                            ptyProcess.resize(msg.cols, msg.rows);
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
                // Only set timeout if this is the active WebSocket for the session
                session.timeoutId = setTimeout(() => {
                    console.log(`Session ${sessionID} timed out. Killing process.`);
                    if (session.ptyProcess && !session.ptyProcess.killed) {
                        session.ptyProcess.kill();
                    }
                    sessions.delete(sessionID);
                }, SESSION_TIMEOUT);
            }
        });

        // Handle WebSocket errors
        ws.on('error', (error) => {
            console.error(`WebSocket error for session ${sessionID}:`, error);
            const session = sessions.get(sessionID);
            if (session && session.ws === ws) {
                // Only set timeout if this is the active WebSocket for the session
                session.timeoutId = setTimeout(() => {
                    console.log(`Session ${sessionID} timed out due to error. Killing process.`);
                    if (session.ptyProcess && !session.ptyProcess.killed) {
                        session.ptyProcess.kill();
                    }
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
        // Clean up properly
        if (session.timeoutId) {
            clearTimeout(session.timeoutId);
        }
        if (session.ws && session.ws.readyState === WebSocket.OPEN) {
            session.ws.close();
        }
        if (session.ptyProcess && !session.ptyProcess.killed) {
            session.ptyProcess.kill();
        }
    }
    sessions.delete(sessionId);
}

module.exports = {
    setupWebSocketServer,
    getSessions,
    deleteSession
};