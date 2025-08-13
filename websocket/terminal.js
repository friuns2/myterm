const WebSocket = require('ws');
const pty = require('node-pty');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const { PROJECTS_DIR } = require('../middleware/security');

// Store active terminal sessions
// session map value shape:
// { ptyProcess, ws, buffer, created, projectName, sessionName, logPath }
const sessions = new Map();
const MAX_BUFFER_SIZE = 100 * 1024; // 100kb

const LOGS_DIR = path.join(__dirname, '..', 'worktrees', 'logs');
function ensureLogsDir() {
    try {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
    } catch (e) {
        // ignore
    }
}

function buildSessionName(sessionID, projectName) {
    const proj = projectName ? encodeURIComponent(projectName) : 'default';
    return `msh_${sessionID}_${proj}`;
}

function parseProjectFromSessionName(sessionName) {
    const parts = sessionName.split('_');
    if (parts.length >= 3 && parts[0] === 'msh') {
        try {
            return decodeURIComponent(parts.slice(2).join('_'));
        } catch (e) {
            return parts.slice(2).join('_');
        }
    }
    return null;
}

function getLogPath(sessionID) {
    ensureLogsDir();
    return path.join(LOGS_DIR, `${sessionID}.log`);
}

function readLogTail(logPath) {
    try {
        if (fs.existsSync(logPath)) {
            const data = fs.readFileSync(logPath, 'utf8');
            if (data.length > MAX_BUFFER_SIZE) {
                return data.slice(-MAX_BUFFER_SIZE);
            }
            return data;
        }
    } catch (e) {
        // ignore
    }
    return '';
}

function appendToLog(logPath, data) {
    try {
        fs.appendFile(logPath, data, () => {});
    } catch (e) {
        // ignore
    }
}

function listAbducoSessions() {
    try {
        // abduco -l prints a table; last column is the name
        const out = execSync('abduco -l', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
        return out
            .split('\n')
            .map(l => l.trim())
            .filter(l => l && l.includes('msh_'))
            .map(l => l.split(/\s+/).pop())
            .filter(Boolean);
    } catch (e) {
        return [];
    }
}

function hasCommand(cmd) {
    try {
        execSync(process.platform === 'win32' ? `where ${cmd}` : `command -v ${cmd}`, { stdio: 'ignore' });
        return true;
    } catch (_) {
        return false;
    }
}

function rehydrateSessionsFromAbduco() {
    const names = listAbducoSessions();
    names.forEach(name => {
        // sessionID is middle segment between first and second underscore
        const parts = name.split('_');
        if (parts.length >= 3 && parts[0] === 'msh') {
            const sessionID = parts[1];
            const projectName = parseProjectFromSessionName(name);
            if (!sessions.has(sessionID)) {
                const logPath = getLogPath(sessionID);
                const buffer = readLogTail(logPath);
                sessions.set(sessionID, {
                    ptyProcess: null,
                    ws: null,
                    buffer,
                    created: new Date().toISOString(),
                    projectName,
                    sessionName: name,
                    logPath
                });
            }
        }
    });
}

function wirePtyHandlers(sessionID) {
    const session = sessions.get(sessionID);
    if (!session || !session.ptyProcess) return;
    const proc = session.ptyProcess;
    // Avoid double wiring by marking a symbol on the proc
    if (proc.__mshWired) return;
    proc.__mshWired = true;
    proc.onData((data) => {
        const s = sessions.get(sessionID);
        if (!s) return;
        s.buffer = (s.buffer || '') + data;
        if (s.buffer.length > MAX_BUFFER_SIZE) s.buffer = s.buffer.slice(-MAX_BUFFER_SIZE);
        appendToLog(s.logPath || getLogPath(sessionID), data);
        if (s.ws && s.ws.readyState === WebSocket.OPEN) {
            try { s.ws.send(JSON.stringify({ type: 'output', data })); } catch (_) {}
        }
    });
    proc.onExit(({ exitCode, signal }) => {
        const s = sessions.get(sessionID);
        if (s) s.ptyProcess = null;
        if (s && s.ws && s.ws.readyState === WebSocket.OPEN) {
            try { s.ws.send(JSON.stringify({ type: 'exit', exitCode, signal })); } catch (_) {}
        }
    });
}

function killAbducoSessionByName(sessionName) {
    return new Promise((resolve) => {
        try {
            const killer = pty.spawn('abduco', ['-a', sessionName], {
                name: 'xterm-color', cols: 80, rows: 24, cwd: process.cwd(), env: process.env
            });
            let settled = false;
            const tidy = (ok) => { if (!settled) { settled = true; resolve(ok); } };
            const timer = setTimeout(() => {
                try { killer.kill(); } catch (_) {}
                tidy(false);
            }, 4000);
            killer.onData(() => {});
            setTimeout(() => { try { killer.write('exit\r'); } catch (_) {} }, 50);
            killer.onExit(() => { clearTimeout(timer); tidy(true); });
        } catch (e) {
            resolve(false);
        }
    });
}

function setupWebSocketServer(server) {
    const wss = new WebSocket.Server({ server });
    // Attempt to recover any existing abduco sessions on startup
    rehydrateSessionsFromAbduco();

    wss.on('connection', (ws, req) => {
        console.log('Terminal connected');
        
        // Parse session ID and project name from query parameters
        const url = new URL(req.url, `http://${req.headers.host}`);
        let sessionID = url.searchParams.get('sessionID');
        const projectName = url.searchParams.get('projectName');
        let ptyProcess;

        if (sessionID && sessions.has(sessionID)) {
            // Reconnect to existing session; re-attach to abduco if needed
            const session = sessions.get(sessionID);
            if (!session.sessionName) {
                session.sessionName = buildSessionName(sessionID, session.projectName);
            }
            if (!session.ptyProcess) {
                const shell = os.platform() === 'win32' ? 'powershell.exe' : 'zsh';
                ptyProcess = pty.spawn('abduco', ['-a', session.sessionName], {
                    name: 'xterm-color',
                    cols: 80,
                    rows: 24,
                    cwd: process.cwd(),
                    env: process.env
                });
                session.ptyProcess = ptyProcess;
                wirePtyHandlers(sessionID);
            } else {
                ptyProcess = session.ptyProcess;
                wirePtyHandlers(sessionID);
            }
            
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
            // Do not send preloaded logs when PTY is active; rely on abduco's screen state
        } else if (!sessionID && projectName) {
            // Create new PTY process and session for a specific project
            sessionID = uuidv4();
            const shell = os.platform() === 'win32' ? 'powershell.exe' : 'zsh';
            const sessionName = buildSessionName(sessionID, projectName);
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
            
            const mergedEnv = process.env;
            
            // Use abduco to create or attach the session
            // Prefer tmux for scrollback preservation if available
            const useTmux = hasCommand('tmux');
            const abducoArgs = useTmux
                ? ['-A', sessionName, 'tmux', 'new-session', '-A', '-s', sessionName]
                : ['-A', sessionName, shell];
            ptyProcess = pty.spawn('abduco', abducoArgs, {
                name: 'xterm-color',
                cols: 80,
                rows: 24,
                cwd: cwd,
                env: mergedEnv
            });

            const logPath = getLogPath(sessionID);
            const session = { ptyProcess, ws, buffer: readLogTail(logPath), created: new Date().toISOString(), projectName: projectName || null, sessionName, logPath };
            sessions.set(sessionID, session);
            console.log(`New session created: ${sessionID} for project: ${projectName || 'default'}`);

            // Send session ID to client
            ws.send(JSON.stringify({
                type: 'sessionID',
                sessionID: sessionID
            }));

            wirePtyHandlers(sessionID);

            // Handle PTY exit
            // exit handler wired in wirePtyHandlers
        } else {
            // Do NOT auto-create sessions when no valid sessionID is provided and no project is specified
            // Send an error to the client and close the connection
            try {
                let message = 'Missing sessionID in query string';
                if (sessionID && !sessions.has(sessionID)) {
                    // Try to see if an abduco session exists with this id and rehydrate
                    const candidates = listAbducoSessions().filter(name => name.startsWith(`msh_${sessionID}_`));
                    if (candidates.length > 0) {
                        const name = candidates[0];
                        const project = parseProjectFromSessionName(name);
                        const logPath = getLogPath(sessionID);
                        sessions.set(sessionID, {
                            ptyProcess: null,
                            ws: ws,
                            buffer: readLogTail(logPath),
                            created: new Date().toISOString(),
                            projectName: project,
                            sessionName: name,
                            logPath
                        });
                        // Re-run handler logic by simulating existing path
                        // Attach now
                        const shell = os.platform() === 'win32' ? 'powershell.exe' : 'zsh';
                        const session = sessions.get(sessionID);
                        const proc = pty.spawn('abduco', ['-a', session.sessionName], {
                            name: 'xterm-color', cols: 80, rows: 24, cwd: process.cwd(), env: process.env
                        });
                        session.ptyProcess = proc;
                        // Do not send preloaded logs now; rely on abduco output
                        // Wire handlers
                        proc.onData((data) => {
                            const s = sessions.get(sessionID);
                            if (!s) return;
                            s.buffer += data;
                            if (s.buffer.length > MAX_BUFFER_SIZE) s.buffer = s.buffer.slice(-MAX_BUFFER_SIZE);
                            appendToLog(s.logPath || getLogPath(sessionID), data);
                            if (s.ws && s.ws.readyState === WebSocket.OPEN) {
                                try { s.ws.send(JSON.stringify({ type: 'output', data })); } catch (_) {}
                            }
                        });
                        proc.onExit(({ exitCode, signal }) => {
                            const s = sessions.get(sessionID);
                            if (s) s.ptyProcess = null;
                            if (s && s.ws && s.ws.readyState === WebSocket.OPEN) {
                                try { s.ws.send(JSON.stringify({ type: 'exit', exitCode, signal })); } catch (_) {}
                            }
                        });
                        // Also send sessionID to client now
                        ws.send(JSON.stringify({ type: 'sessionID', sessionID }));
                        return; // early return; we've set up the session
                    } else {
                        message = `Session not found: ${sessionID}`;
                    }
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

                    case 'requestBuffer':
                        // Deprecated: avoid double-drawing causing cursor jump
                        break;

                    default:
                        console.log('Unknown message type:', msg.type);
                }
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        });

        // Clean up on WebSocket close: detach from abduco by killing the attach PTY, keep session metadata
        ws.on('close', () => {
            console.log(`Terminal disconnected for session: ${sessionID}`);
            const session = sessions.get(sessionID);
            if (session && session.ws === ws) {
                if (session.ptyProcess && !session.ptyProcess.killed) {
                    try { session.ptyProcess.kill(); } catch (e) {}
                }
                session.ptyProcess = null;
                session.ws = null;
            }
        });

        // Handle WebSocket errors
        ws.on('error', (error) => {
            console.error(`WebSocket error for session ${sessionID}:`, error);
            const session = sessions.get(sessionID);
            if (session && session.ws === ws) {
                if (session.ptyProcess && !session.ptyProcess.killed) {
                    try { session.ptyProcess.kill(); } catch (e) {}
                }
                session.ptyProcess = null;
                session.ws = null;
            }
        });
    });

    return wss;
}

function getSessions() {
    return sessions;
}

async function deleteSession(sessionId) {
    const session = sessions.get(sessionId);
    if (session) {
        try {
            if (session.ws && session.ws.readyState === WebSocket.OPEN) {
                session.ws.close();
            }
            if (session.ptyProcess && !session.ptyProcess.killed) {
                try { session.ptyProcess.kill(); } catch (_) {}
                session.ptyProcess = null;
            }
            if (session.sessionName) {
                await killAbducoSessionByName(session.sessionName);
            }
        } finally {
            sessions.delete(sessionId);
        }
    } else {
        // Try to find by abduco listing
        const candidates = listAbducoSessions().filter(name => name.startsWith(`msh_${sessionId}_`));
        if (candidates.length > 0) {
            await killAbducoSessionByName(candidates[0]);
        }
        sessions.delete(sessionId);
    }
}

module.exports = {
    setupWebSocketServer,
    getSessions,
    deleteSession
};