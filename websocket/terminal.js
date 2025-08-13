const WebSocket = require('ws');
const pty = require('node-pty');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const { PROJECTS_DIR } = require('../middleware/security');

// Store active terminal sessions
const sessions = new Map(); // Map: sessionID -> { ptyProcess, ws, timeoutId, buffer, projectName, socketPath, logPath, pidPath, metaPath }
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000;
const MAX_BUFFER_SIZE = 100 * 1024; // Maximum number of characters to buffer (10kb)

// dtach storage directory
const DTACH_DIR = path.join(os.tmpdir(), 'myshell23-dtach');
ensureDir(DTACH_DIR);

function hasDtach() {
    try {
        execFileSync('which', ['dtach'], { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}

function ensureDir(dirPath) {
    try {
        if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
    } catch (e) {
        console.error('Failed to ensure directory:', dirPath, e);
    }
}

function sessionPaths(sessionID) {
    const socketPath = path.join(DTACH_DIR, `${sessionID}.sock`);
    const logPath = path.join(DTACH_DIR, `${sessionID}.log`);
    const pidPath = path.join(DTACH_DIR, `${sessionID}.pid`);
    const metaPath = path.join(DTACH_DIR, `${sessionID}.json`);
    return { socketPath, logPath, pidPath, metaPath };
}

function tailFile(filePath, maxBytes) {
    try {
        const stats = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
        if (!stats) return '';
        const size = stats.size;
        const start = Math.max(0, size - maxBytes);
        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(size - start);
        fs.readSync(fd, buf, 0, buf.length, start);
        fs.closeSync(fd);
        return buf.toString('utf8');
    } catch (e) {
        return '';
    }
}

function appendToFile(filePath, data) {
    try {
        fs.appendFileSync(filePath, data);
    } catch (e) {
        // ignore
    }
}

function writeJSON(filePath, obj) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
    } catch (e) {
        // ignore
    }
}

function readJSON(filePath) {
    try {
        if (!fs.existsSync(filePath)) return null;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        return null;
    }
}

function fileIsSocket(filePath) {
    try {
        const s = fs.statSync(filePath);
        return s.isSocket();
    } catch (e) {
        return false;
    }
}

function setupWebSocketServer(server) {
    const wss = new WebSocket.Server({ server });

    // On startup, auto-register any lingering dtach sessions
    if (hasDtach()) {
        try {
            const files = fs.readdirSync(DTACH_DIR);
            files.filter(f => f.endsWith('.sock')).forEach(sockFile => {
                const sessionID = sockFile.replace(/\.sock$/, '');
                const { socketPath, logPath, pidPath, metaPath } = sessionPaths(sessionID);
                if (fileIsSocket(socketPath)) {
                    const meta = readJSON(metaPath) || {};
                    sessions.set(sessionID, {
                        ptyProcess: null,
                        ws: null,
                        timeoutId: null,
                        buffer: tailFile(logPath, MAX_BUFFER_SIZE),
                        created: meta.created || new Date().toISOString(),
                        projectName: meta.projectName || 'Unknown',
                        socketPath,
                        logPath,
                        pidPath,
                        metaPath
                    });
                }
            });
        } catch (e) {
            // ignore
        }
    }

    wss.on('connection', (ws, req) => {
        console.log('Terminal connected');
        
        // Parse session ID and project name from query parameters
        const url = new URL(req.url, `http://${req.headers.host}`);
        let sessionID = url.searchParams.get('sessionID');
        const projectName = url.searchParams.get('projectName');
        let ptyProcess;

        if (sessionID && sessions.has(sessionID)) {
            // Attach to existing dtach session by spawning a dtach client under a PTY
            const session = sessions.get(sessionID);
            const { socketPath, logPath } = session;
            if (!hasDtach()) {
                // Fallback: no dtach available; just rewire ws to existing PTY process if any
                // Clear previous timeout
                if (session.timeoutId) { clearTimeout(session.timeoutId); session.timeoutId = null; }
                if (session.ws && session.ws !== ws && session.ws.readyState === WebSocket.OPEN) {
                    session.ws.close(1000, 'New connection established');
                }
                session.ws = ws;
                ptyProcess = session.ptyProcess;
                if (session.buffer && session.buffer.length > 0) {
                    ws.send(JSON.stringify({ type: 'output', data: session.buffer }));
                }
            } else {
            // If previous client exists, kill it
            if (session.ptyProcess && !session.ptyProcess.killed) {
                try { session.ptyProcess.kill(); } catch (e) {}
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

            // Spawn dtach attach client under a PTY; resizing this PTY will propagate
            ptyProcess = pty.spawn('dtach', ['-a', socketPath], {
                name: 'xterm-color',
                cols: 80,
                rows: 24,
                cwd: process.cwd(),
                env: process.env
            });

            // Update session
            session.ptyProcess = ptyProcess;
            session.ws = ws;
            console.log(`Reattached to dtach session: ${sessionID}`);

            // Send buffered content to reconnecting client
            if (session.buffer && session.buffer.length > 0) {
                ws.send(JSON.stringify({ type: 'output', data: session.buffer }));
            }

            // Hook data events for this new client
            ptyProcess.onData((data) => {
                const currentSession = sessions.get(sessionID);
                if (!currentSession) return;
                currentSession.buffer += data;
                if (currentSession.buffer.length > MAX_BUFFER_SIZE) {
                    currentSession.buffer = currentSession.buffer.slice(-MAX_BUFFER_SIZE);
                }
                appendToFile(logPath, data);
                if (currentSession.ws && currentSession.ws.readyState === WebSocket.OPEN) {
                    try { currentSession.ws.send(JSON.stringify({ type: 'output', data })); } catch (e) {}
                }
            });

            ptyProcess.onExit(() => {
                const currentSession = sessions.get(sessionID);
                if (currentSession && currentSession.ws && currentSession.ws.readyState === WebSocket.OPEN) {
                    try { currentSession.ws.send(JSON.stringify({ type: 'exit', exitCode: 0 })); } catch (e) {}
                }
                // Do not delete session here; dtach server persists
            });
            }
        } else if (!sessionID && projectName) {
            // Create new PTY process and session for a specific project
            sessionID = uuidv4();
            const shell = os.platform() === 'win32' ? 'powershell.exe' : 'zsh';

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

            if (!hasDtach()) {
                // Fallback: original PTY spawning without dtach
                const mergedEnv = process.env;
                ptyProcess = pty.spawn(shell, [], { name: 'xterm-color', cols: 80, rows: 24, cwd, env: mergedEnv });
                const session = { ptyProcess, ws, timeoutId: null, buffer: '', created: new Date().toISOString(), projectName: projectName || null };
                sessions.set(sessionID, session);
                console.log(`New session created (no dtach): ${sessionID} for project: ${projectName || 'default'}`);
                ws.send(JSON.stringify({ type: 'sessionID', sessionID }));
                ptyProcess.onData((data) => {
                    const currentSession = sessions.get(sessionID);
                    if (!currentSession) return;
                    currentSession.buffer += data;
                    if (currentSession.buffer.length > MAX_BUFFER_SIZE) {
                        currentSession.buffer = currentSession.buffer.slice(-MAX_BUFFER_SIZE);
                    }
                    if (currentSession.ws && currentSession.ws.readyState === WebSocket.OPEN) {
                        try { currentSession.ws.send(JSON.stringify({ type: 'output', data })); } catch (error) {}
                    }
                });
                ptyProcess.onExit(({ exitCode, signal }) => {
                    console.log(`Process exited with code: ${exitCode}, signal: ${signal}`);
                    const currentSession = sessions.get(sessionID);
                    if (currentSession && currentSession.ws && currentSession.ws.readyState === WebSocket.OPEN) {
                        try { currentSession.ws.send(JSON.stringify({ type: 'exit', exitCode, signal })); } catch (error) {}
                    }
                    sessions.delete(sessionID);
                });
            } else {
                const { socketPath, logPath, pidPath, metaPath } = sessionPaths(sessionID);
                // Persist meta for recovery
                writeJSON(metaPath, { sessionID, projectName: projectName || null, created: new Date().toISOString() });
                // Ensure empty log file exists
                appendToFile(logPath, '');
                // Start a dtach server detached in project cwd
                try {
                    try {
                        execFileSync('dtach', ['-n', socketPath, 'sh', '-lc', `echo $$ > "${pidPath}"; export HISTFILE="${path.join(cwd, '.zsh_history')}"; setopt APPEND_HISTORY INC_APPEND_HISTORY SHARE_HISTORY 2>/dev/null; exec ${shell} -l`], { cwd });
                    } catch (e) {
                        spawn('dtach', ['-A', socketPath, 'sh', '-lc', `echo $$ > "${pidPath}"; export HISTFILE="${path.join(cwd, '.zsh_history')}"; setopt APPEND_HISTORY INC_APPEND_HISTORY SHARE_HISTORY 2>/dev/null; exec ${shell} -l`], { cwd, detached: true, stdio: 'ignore' }).unref();
                    }
                } catch (e) {
                    console.error('Failed to start dtach session:', e.message);
                }
                // Now attach a client under our PTY for this websocket
                ptyProcess = pty.spawn('dtach', ['-a', socketPath], { name: 'xterm-color', cols: 80, rows: 24, cwd, env: process.env });
                const session = { ptyProcess, ws, timeoutId: null, buffer: '', created: new Date().toISOString(), projectName: projectName || null, socketPath, logPath, pidPath, metaPath };
                sessions.set(sessionID, session);
                console.log(`New dtach session created: ${sessionID} for project: ${projectName || 'default'}`);
                ws.send(JSON.stringify({ type: 'sessionID', sessionID }));
                ptyProcess.onData((data) => {
                    const currentSession = sessions.get(sessionID);
                    if (!currentSession) return;
                    currentSession.buffer += data;
                    if (currentSession.buffer.length > MAX_BUFFER_SIZE) {
                        currentSession.buffer = currentSession.buffer.slice(-MAX_BUFFER_SIZE);
                    }
                    appendToFile(logPath, data);
                    if (currentSession.ws && currentSession.ws.readyState === WebSocket.OPEN) {
                        try { currentSession.ws.send(JSON.stringify({ type: 'output', data })); } catch (error) {}
                    }
                });
                ptyProcess.onExit(({ exitCode, signal }) => {
                    console.log(`Attach client exited with code: ${exitCode}, signal: ${signal}`);
                    const currentSession = sessions.get(sessionID);
                    if (currentSession && currentSession.ws && currentSession.ws.readyState === WebSocket.OPEN) {
                        try { currentSession.ws.send(JSON.stringify({ type: 'exit', exitCode, signal })); } catch (error) {}
                    }
                    // Do not delete session; dtach server keeps running until killed
                });
            }
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
                    console.log(`Session ${sessionID} idle timeout. Closing attach client.`);
                    if (session.ptyProcess && !session.ptyProcess.killed) {
                        try { session.ptyProcess.kill(); } catch (e) {}
                    }
                    // Keep dtach server alive; do not delete session entry
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
                    console.log(`Session ${sessionID} error timeout. Closing attach client.`);
                    if (session.ptyProcess && !session.ptyProcess.killed) {
                        try { session.ptyProcess.kill(); } catch (e) {}
                    }
                    // Keep dtach server alive
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
        try {
            if (session.timeoutId) clearTimeout(session.timeoutId);
            if (session.ws && session.ws.readyState === WebSocket.OPEN) session.ws.close();
            if (session.ptyProcess && !session.ptyProcess.killed) {
                try { session.ptyProcess.kill(); } catch (e) {}
            }

            // Attempt to kill the underlying dtach-managed shell via PID file
            if (session.pidPath && fs.existsSync(session.pidPath)) {
                try {
                    const pid = parseInt(fs.readFileSync(session.pidPath, 'utf8').trim(), 10);
                    if (!Number.isNaN(pid)) process.kill(pid, 'TERM');
                } catch (e) {
                    // ignore
                }
            }

            // Cleanup files
            try { if (session.socketPath && fs.existsSync(session.socketPath)) fs.unlinkSync(session.socketPath); } catch (e) {}
            try { if (session.pidPath && fs.existsSync(session.pidPath)) fs.unlinkSync(session.pidPath); } catch (e) {}
            try { if (session.metaPath && fs.existsSync(session.metaPath)) fs.unlinkSync(session.metaPath); } catch (e) {}
            // Keep log for inspection; do not delete log file
        } finally {
            sessions.delete(sessionId);
        }
    } else {
        // Fallback: remove stray files if exist
        const { socketPath, pidPath, metaPath } = sessionPaths(sessionId);
        try { if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath); } catch (e) {}
        try { if (fs.existsSync(pidPath)) fs.unlinkSync(pidPath); } catch (e) {}
        try { if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath); } catch (e) {}
    }
}

module.exports = {
    setupWebSocketServer,
    getSessions,
    deleteSession
};