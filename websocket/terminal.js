const WebSocket = require('ws');
const pty = require('node-pty');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const { PROJECTS_DIR } = require('../middleware/security');
const { registerSession, unregisterSession, getSessionInfo, getAllSessionsInfo } = require('./sessionRegistry');

const SESSIONS_LOG_DIR = path.join(__dirname, '..', 'sessions');

// Store active websocket-attached client state and rolling buffers
const sessions = new Map(); // Map: sessionID -> { ws, buffer, projectName, created }
const MAX_BUFFER_SIZE = 100 * 1024; // Maximum number of characters to buffer (100kb)

function listAbducoSessions() {
    try {
        const out = execSync('abduco -l', { encoding: 'utf8' });
        // Example lines may look like:
        //  Mon 01 Jan 00:00:00 2025  detached  mysession
        //  Mon 01 Jan 00:00:00 2025  attached  anothersession
        const lines = out.split('\n').map(l => l.trim()).filter(Boolean);
        const result = [];
        for (const line of lines) {
            const parts = line.split(/\s+/);
            const name = parts[parts.length - 1];
            const attached = line.includes('attached');
            if (name && name !== 'sessions:' && !name.includes(':')) {
                result.push({ id: name, attached });
            }
        }
        return result;
    } catch (_) {
        return [];
    }
}

function abducoSessionExists(sessionID) {
    return listAbducoSessions().some(s => s.id === sessionID);
}

function setupWebSocketServer(server) {
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws, req) => {
        console.log('Terminal connected');
        
        // Parse session ID and project name from query parameters
        const url = new URL(req.url, `http://${req.headers.host}`);
        let sessionID = url.searchParams.get('sessionID');
        const projectName = url.searchParams.get('projectName');
        let ptyProcess; // this is the abduco attach/create client process

        // Establish or attach to abduco-backed session
        if (!sessionID && projectName) {
            // New session in given project
            sessionID = uuidv4();
        }

        if (!sessionID) {
            // Do NOT auto-create sessions when no valid sessionID is provided and no project is specified
            // Send an error to the client and close the connection
            try {
                let message = 'Missing sessionID in query string';
                ws.send(JSON.stringify({ type: 'error', message }));
            } catch (e) {
                // ignore send errors
            }
            ws.close(1008, 'Invalid session');
            return;
        }

        // Resolve project working directory
        let cwd = process.cwd();
        let resolvedProject = projectName;
        if (resolvedProject) {
            const projectPath = path.join(PROJECTS_DIR, resolvedProject);
            if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, { recursive: true });
            cwd = projectPath;
        } else {
            const info = getSessionInfo(sessionID);
            if (info && info.projectName) {
                const projectPath = path.join(PROJECTS_DIR, info.projectName);
                if (fs.existsSync(projectPath)) {
                    cwd = projectPath;
                    resolvedProject = info.projectName;
                }
            }
        }

        if (!fs.existsSync(SESSIONS_LOG_DIR)) {
            try { fs.mkdirSync(SESSIONS_LOG_DIR, { recursive: true }); } catch (_) {}
        }

        const logPath = path.join(SESSIONS_LOG_DIR, `${sessionID}.log`);
        const isWin = os.platform() === 'win32';
        const createArgs = isWin
            ? ['-c', sessionID, 'powershell.exe']
            : ['-c', sessionID, 'zsh'];
        const attachArgs = ['-a', sessionID];

        const ensureAttached = () => {
            const exists = abducoSessionExists(sessionID);
            const args = exists ? attachArgs : createArgs;
            const env = process.env;
            ptyProcess = pty.spawn('abduco', args, {
                name: 'xterm-color',
                cols: 80,
                rows: 24,
                cwd: exists ? process.cwd() : cwd,
                env
            });

            // Register metadata on creation path
            if (!exists) {
                registerSession(sessionID, resolvedProject || null);
            }

            // Create/refresh session entry
            const existing = sessions.get(sessionID) || { buffer: '', created: new Date().toISOString() };
            const session = {
                ws,
                buffer: existing.buffer || '',
                created: existing.created,
                projectName: resolvedProject || (existing.projectName || null)
            };
            sessions.set(sessionID, session);

            // Inform client of sessionID only if it's a new session (no sessionID provided by client)
            if (!url.searchParams.get('sessionID')) {
                ws.send(JSON.stringify({ type: 'sessionID', sessionID }));
            }

            // Send buffered history or log tail immediately on connect
            let sentHistory = false;
            if (session.buffer && session.buffer.length > 0) {
                try {
                    ws.send(JSON.stringify({ type: 'output', data: session.buffer }));
                    sentHistory = true;
                } catch (_) {}
            }
            if (!sentHistory) {
                try {
                    const stats = fs.existsSync(logPath) ? fs.statSync(logPath) : null;
                    if (stats && stats.size > 0) {
                        const bytesToRead = Math.min(stats.size, MAX_BUFFER_SIZE);
                        const fd = fs.openSync(logPath, 'r');
                        const buf = Buffer.alloc(bytesToRead);
                        fs.readSync(fd, buf, 0, bytesToRead, stats.size - bytesToRead);
                        fs.closeSync(fd);
                        const prehistory = buf.toString('utf8');
                        session.buffer = prehistory;
                        ws.send(JSON.stringify({ type: 'output', data: prehistory }));
                    }
                } catch (_) {}
            }

            // Pipe abduco client output to ws and buffer
            ptyProcess.onData((data) => {
                const currentSession = sessions.get(sessionID);
                if (!currentSession) return;
                currentSession.buffer += data;
                if (currentSession.buffer.length > MAX_BUFFER_SIZE) {
                    currentSession.buffer = currentSession.buffer.slice(-MAX_BUFFER_SIZE);
                }
                if (currentSession.ws && currentSession.ws.readyState === WebSocket.OPEN) {
                    try {
                        currentSession.ws.send(JSON.stringify({ type: 'output', data }));
                    } catch (error) {
                        // ignore transient send errors
                    }
                }
            });

            ptyProcess.onExit(({ exitCode, signal }) => {
                // abduco client exited (detach/close). Keep session entry for status/history
                const currentSession = sessions.get(sessionID);
                if (currentSession && currentSession.ws && currentSession.ws.readyState === WebSocket.OPEN) {
                    try {
                        currentSession.ws.send(JSON.stringify({ type: 'exit', exitCode, signal }));
                    } catch (_) {}
                }
            });
        };

        // Start abduco attach/create client
        ensureAttached();

        // Handle WebSocket messages
        ws.on('message', (message) => {
            try {
                const msg = JSON.parse(message);

                // Validate that this WebSocket is still the active one for this session
                const currentSession = sessions.get(sessionID);
                if (!currentSession || currentSession.ws !== ws) return;

                switch (msg.type) {
                    case 'input':
                        if (ptyProcess && !ptyProcess.killed) ptyProcess.write(msg.data);
                        break;

                    case 'resize':
                        if (ptyProcess && !ptyProcess.killed) ptyProcess.resize(msg.cols, msg.rows);
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
            const session = sessions.get(sessionID);
            if (session && session.ws === ws) {
                // Close the abduco client process (underlying session remains)
                try { if (ptyProcess && !ptyProcess.killed) ptyProcess.kill(); } catch (_) {}
                // Keep session metadata and buffer for dashboard
            }
        });

        // Handle WebSocket errors
        ws.on('error', () => {
            const session = sessions.get(sessionID);
            if (session && session.ws === ws) {
                try { if (ptyProcess && !ptyProcess.killed) ptyProcess.kill(); } catch (_) {}
            }
        });
    });

    return wss;
}

function getSessions() {
    return sessions;
}

async function deleteSession(sessionId) {
    // Kill supervising abduco process for this session by matching its command line
    try {
        if (!abducoSessionExists(sessionId)) {
            unregisterSession(sessionId);
            sessions.delete(sessionId);
            return true;
        }

        // Find a matching abduco PID (first match)
        let pid = null;
        try {
            const cmd = `pgrep -fl '^abduco( |$).* ${sessionId}( |$)' | awk '{print $1}' | head -n1`;
            const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
            pid = out || null;
        } catch (_) {
            pid = null;
        }

        if (pid) {
            try { execSync(`kill ${pid}`, { stdio: 'ignore' }); } catch (_) {}
        }

        // Give it a brief moment, then re-check; escalate if needed
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        await wait(200);
        if (abducoSessionExists(sessionId)) {
            // Try a broader pkill as fallback
            try { execSync(`pkill -f 'abduco.* ${sessionId}( |$)'`, { stdio: 'ignore', shell: '/bin/zsh' }); } catch (_) {}
            await wait(200);
        }

        const gone = !abducoSessionExists(sessionId);
        if (gone) unregisterSession(sessionId);
        sessions.delete(sessionId);
        return gone;
    } catch (_) {
        return false;
    }
}

module.exports = {
    setupWebSocketServer,
    getSessions,
    deleteSession,
    listAbducoSessions,
    getAllSessionsInfo
};