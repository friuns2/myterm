const WebSocket = require('ws');
const pty = require('node-pty');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { PROJECTS_DIR } = require('../middleware/security');
const { execSync } = require('child_process');

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

        const TMUX_PREFIX = 'msh-';

        function sanitizeName(name) {
            return String(name || '')
                .replace(/[^a-zA-Z0-9_.-]+/g, '-')
                .replace(/^-+/, '')
                .slice(0, 64);
        }

        function generateTmuxSessionName(project) {
            const shortId = uuidv4().slice(0, 8);
            return `${TMUX_PREFIX}${shortId}-${sanitizeName(project || 'default')}`;
        }

        function tmuxSessionExists(name) {
            try {
                execSync(`tmux has-session -t ${name}`, { stdio: 'ignore' });
                return true;
            } catch (_) {
                return false;
            }
        }

        function createTmuxSession(name, cwd) {
            try {
                execSync(`tmux new-session -d -s ${name} -c ${JSON.stringify(cwd).slice(1, -1)}`);
            } catch (error) {
                console.error('Failed to create tmux session:', error.message);
                throw error;
            }
        }

        function attachToTmux(name, cwd) {
            const env = process.env;
            return pty.spawn('tmux', ['attach-session', '-t', name], {
                name: 'xterm-color',
                cols: 80,
                rows: 24,
                cwd,
                env
            });
        }

        const startPtyForTmux = (tmuxName, cwdForAttach, sendId = true) => {
            ptyProcess = attachToTmux(tmuxName, cwdForAttach);
            const session = { ptyProcess, ws, timeoutId: null, buffer: '', created: new Date().toISOString(), projectName: projectName || null };
            sessions.set(tmuxName, session);
            sessionID = tmuxName;
            console.log(`Attached to tmux session: ${tmuxName} ${projectName ? `(project: ${projectName})` : ''}`);
            if (sendId) {
                ws.send(JSON.stringify({ type: 'sessionID', sessionID: tmuxName }));
            }

            // Set up PTY event handlers
            // Send PTY output to WebSocket and buffer it
            ptyProcess.onData((data) => {
                const currentSession = sessions.get(tmuxName);
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
                            console.error(`Error sending data to session ${tmuxName}:`, error);
                            // If there's an error sending, the WebSocket is likely closed
                            // Don't try to use it anymore
                            if (currentSession.ws.readyState !== WebSocket.OPEN) {
                                console.log(`WebSocket for session ${tmuxName} is no longer open`);
                            }
                        }
                    }
                }
            });

            // Handle PTY exit
            ptyProcess.onExit(({ exitCode, signal }) => {
                console.log(`Attach client exited with code: ${exitCode}, signal: ${signal}`);
                const currentSession = sessions.get(tmuxName);
                if (currentSession && currentSession.ws && currentSession.ws.readyState === WebSocket.OPEN) {
                    try {
                        currentSession.ws.send(JSON.stringify({
                            type: 'exit',
                            exitCode,
                            signal
                        }));
                    } catch (error) {
                        console.error(`Error sending exit message to session ${tmuxName}:`, error);
                    }
                }
                sessions.delete(tmuxName); // Clean up in-memory attach client on exit; tmux session persists
            });
        };
        if (sessionID && sessions.has(sessionID)) {
            // Reconnect to existing attach client (single active ws per attach)
            const session = sessions.get(sessionID);
            ptyProcess = session.ptyProcess;
            if (session.timeoutId) {
                clearTimeout(session.timeoutId);
                session.timeoutId = null;
            }
            if (session.ws && session.ws !== ws && session.ws.readyState === WebSocket.OPEN) {
                console.log(`Closing previous WebSocket connection for session: ${sessionID}`);
                session.ws.close(1000, 'New connection established');
            }
            session.ws = ws;
            console.log(`Reconnected to attach client for tmux session: ${sessionID}`);
            if (session.buffer && session.buffer.length > 0) {
                ws.send(JSON.stringify({ type: 'output', data: session.buffer }));
                console.log(`Sent ${session.buffer.length} characters from buffer`);
            }
        } else if (sessionID && !sessions.has(sessionID)) {
            // If a tmux session exists with this name, attach to it; otherwise error
            if (tmuxSessionExists(sessionID)) {
                // Determine cwd for attach: use process cwd or project path if resolvable from name
                let cwd = process.cwd();
                try {
                    // Try to read the session default-path
                    const sessionPath = execSync(`tmux display-message -p -t ${sessionID} "#{session_path}"`, { encoding: 'utf8' }).trim();
                    if (sessionPath) cwd = sessionPath;
                } catch (_) {}
                startPtyForTmux(sessionID, cwd, false);
            } else {
                try {
                    const message = `Session not found: ${sessionID}`;
                    ws.send(JSON.stringify({ type: 'error', message }));
                } catch (e) {}
                ws.close(1008, 'Invalid session');
                return;
            }
        } else if (!sessionID && projectName) {
            // Determine working directory
            let cwd = process.cwd();
            const projectPath = path.join(PROJECTS_DIR, projectName);
            if (fs.existsSync(projectPath)) {
                cwd = projectPath;
            } else {
                fs.mkdirSync(projectPath, { recursive: true });
                cwd = projectPath;
            }

            // Create a new tmux session and attach to it
            const tmuxName = generateTmuxSessionName(projectName);
            createTmuxSession(tmuxName, cwd);
            startPtyForTmux(tmuxName, cwd, true);
        } else {
            // Missing information; do not create anything
            try {
                let message = 'Missing sessionID or projectName in query string';
                ws.send(JSON.stringify({ type: 'error', message }));
            } catch (e) {}
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
                    console.log(`Session ${sessionID} timed out. Closing attach client.`);
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