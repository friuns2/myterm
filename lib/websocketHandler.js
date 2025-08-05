const WebSocket = require('ws');

class WebSocketHandler {
    constructor(sessionManager) {
        this.sessionManager = sessionManager;
    }

    handleConnection(ws, req) {
        console.log('Terminal connected');

        let sessionID = req.url.split('?sessionID=')[1];
        let ptyProcess;
        let session;

        if (sessionID && this.sessionManager.hasSession(sessionID)) {
            // Reconnect to existing session
            session = this.sessionManager.updateSessionWebSocket(sessionID, ws);
            ptyProcess = session.ptyProcess;
            console.log(`Reconnected to session: ${sessionID}`);
            
            // Send buffered content to reconnecting client
            const buffer = this.sessionManager.getBuffer(sessionID);
            if (buffer && buffer.length > 0) {
                ws.send(JSON.stringify({
                    type: 'output',
                    data: buffer
                }));
                console.log(`Sent ${buffer.length} characters from buffer`);
            }
        } else {
            // Create new session
            const newSession = this.sessionManager.createSession();
            sessionID = newSession.sessionID;
            session = newSession.session;
            ptyProcess = session.ptyProcess;
            
            // Update session with WebSocket
            this.sessionManager.updateSessionWebSocket(sessionID, ws);

            // Send session ID to client
            ws.send(JSON.stringify({
                type: 'sessionID',
                sessionID: sessionID
            }));

            // Set up PTY event handlers only for new sessions
            this.setupPtyHandlers(sessionID, ptyProcess);
        }

        // Set up WebSocket event handlers
        this.setupWebSocketHandlers(ws, sessionID, ptyProcess);
    }

    setupPtyHandlers(sessionID, ptyProcess) {
        // Send PTY output to WebSocket and buffer it
        ptyProcess.onData((data) => {
            const currentSession = this.sessionManager.getSession(sessionID);
            if (currentSession) {
                // Add data to buffer
                this.sessionManager.addToBuffer(sessionID, data);
                
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
            const currentSession = this.sessionManager.getSession(sessionID);
            if (currentSession && currentSession.ws && currentSession.ws.readyState === WebSocket.OPEN) {
                currentSession.ws.send(JSON.stringify({
                    type: 'exit',
                    exitCode,
                    signal
                }));
            }
            this.sessionManager.deleteSession(sessionID); // Clean up session on exit
        });
    }

    setupWebSocketHandlers(ws, sessionID, ptyProcess) {
        // Handle WebSocket messages
        ws.on('message', (message) => {
            try {
                const msg = JSON.parse(message);
                this.handleMessage(msg, ptyProcess);
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        });

        // Clean up on WebSocket close
        ws.on('close', () => {
            console.log('Terminal disconnected');
            this.sessionManager.setSessionTimeout(sessionID);
        });

        // Handle WebSocket errors
        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            this.sessionManager.setSessionTimeout(sessionID);
        });
    }

    handleMessage(msg, ptyProcess) {
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
    }
}

module.exports = WebSocketHandler;