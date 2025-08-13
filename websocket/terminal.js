const WebSocket = require('ws');
const pty = require('node-pty-prebuilt-multiarch');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { PROJECTS_DIR } = require('../middleware/security');
const { execSync } = require('child_process');
const mux = require('../lib/mux');

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

        function isTmuxAvailable() { return false; }

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

        function tmuxSessionExists(name) { return mux.hasSession(name); }

        function createTmuxSession(name, cwd) { return !!mux.createSession(name, cwd, { cols: 120, rows: 40 }); }

        function enableMouseForSession() { return true; }

        function attachToSession(name) {
            const s = mux.getSession(name);
            if (!s) return null;
            return s.pty;
        }

        function attachAndWire(tmuxName, cwdForAttach, sendId) {
            try {
                ptyProcess = attachToSession(tmuxName);
                if (!ptyProcess) throw new Error('No session');
            } catch (error) {
                console.error('Failed to attach session:', error.message || String(error));
                try { ws.send(JSON.stringify({ type: 'error', message: 'Failed to attach session' })); } catch (_) {}
                try { ws.close(1011, 'Attach failed'); } catch (_) {}
                return false;
            }
            console.log(`Attached to session: ${tmuxName} ${projectName ? `(project: ${projectName})` : ''}`);
            if (sendId) {
                ws.send(JSON.stringify({ type: 'sessionID', sessionID: tmuxName }));
            }

            ptyProcess.onData((data) => {
                if (ws.readyState === WebSocket.OPEN) {
                    try {
                        ws.send(JSON.stringify({ type: 'output', data }));
                    } catch (error) {
                        console.error(`Error sending data to session ${tmuxName}:`, error);
                    }
                }
            });

            ptyProcess.onExit(({ exitCode, signal }) => {
                console.log(`Attach client exited with code: ${exitCode}, signal: ${signal}`);
                if (ws.readyState === WebSocket.OPEN) {
                    try {
                        ws.send(JSON.stringify({ type: 'exit', exitCode, signal }));
                    } catch (error) {
                        console.error(`Error sending exit message to session ${tmuxName}:`, error);
                    }
                }
            });
            return true;
        }

        // Ensure tmux is available
        // Using built-in mux; tmux not required

        if (sessionID) {
            if (tmuxSessionExists(sessionID)) {
                let cwd = process.cwd();
                const s = mux.getSession(sessionID);
                if (s) cwd = s.cwd;
                enableMouseForSession(sessionID);
                const ok = attachAndWire(sessionID, cwd, false);
                if (!ok) return;
            } else {
                try { ws.send(JSON.stringify({ type: 'error', message: `Session not found: ${sessionID}` })); } catch (e) {}
                ws.close(1008, 'Invalid session');
                return;
            }
        } else if (projectName) {
            let cwd = process.cwd();
            const projectPath = path.join(PROJECTS_DIR, projectName);
            if (fs.existsSync(projectPath)) {
                cwd = projectPath;
            } else {
                fs.mkdirSync(projectPath, { recursive: true });
                cwd = projectPath;
            }
            const tmuxName = generateTmuxSessionName(projectName);
            const created = createTmuxSession(tmuxName, cwd);
            if (!created) {
                try { ws.send(JSON.stringify({ type: 'error', message: 'Failed to create tmux session' })); } catch (_) {}
                try { ws.close(1011, 'tmux create failed'); } catch (_) {}
                return;
            }
            enableMouseForSession(tmuxName);
            const ok = attachAndWire(tmuxName, cwd, true);
            if (!ok) return;
        } else {
            try { ws.send(JSON.stringify({ type: 'error', message: 'Missing sessionID or projectName in query string' })); } catch (e) {}
            ws.close(1008, 'Invalid session');
            return;
        }

        // Handle WebSocket messages
        ws.on('message', (message) => {
            try {
                const msg = JSON.parse(message);

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
            console.log(`Terminal disconnected for session: ${sessionID || 'new'}`);
            if (ptyProcess && !ptyProcess.killed) {
                try { ptyProcess.kill(); } catch (_) { console.error('Failed to kill pty process'); }
            }
        });

        // Handle WebSocket errors
        ws.on('error', (error) => {
            console.error(`WebSocket error for session ${sessionID || 'new'}:`, error);
            if (ptyProcess && !ptyProcess.killed) {
                try { ptyProcess.kill(); } catch (_) { console.error('Failed to kill pty process'); }
            }
        });
    });

    return wss;
}

module.exports = {
    setupWebSocketServer
};