const WebSocket = require('ws');
const sessionManager = require('./sessionManager');

class WebSocketHandler {
  constructor(server) {
    this.wss = new WebSocket.Server({ server });
    this.setupWebSocketServer();
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      console.log('Terminal connected');
      
      // Parse session ID and project name from query parameters
      const url = new URL(req.url, `http://${req.headers.host}`);
      let sessionID = url.searchParams.get('sessionID');
      const projectName = url.searchParams.get('projectName');
      let ptyProcess;

      if (sessionID && sessionManager.hasSession(sessionID)) {
        // Reconnect to existing session
        const success = sessionManager.reconnectSession(sessionID, ws);
        if (success) {
          const session = sessionManager.getSession(sessionID);
          ptyProcess = session.ptyProcess;
        } else {
          // Session not found, create new one
          sessionID = this.createNewSession(ws, projectName);
          ptyProcess = sessionManager.getSession(sessionID).ptyProcess;
        }
      } else {
        // Create new PTY process and session
        sessionID = this.createNewSession(ws, projectName);
        ptyProcess = sessionManager.getSession(sessionID).ptyProcess;
      }

      // Handle WebSocket messages
      ws.on('message', (message) => {
        this.handleWebSocketMessage(message, ptyProcess);
      });

      // Clean up on WebSocket close
      ws.on('close', () => {
        this.handleWebSocketClose(sessionID);
      });

      // Handle WebSocket errors
      ws.on('error', (error) => {
        this.handleWebSocketError(error, sessionID);
      });
    });
  }

  createNewSession(ws, projectName) {
    const { sessionID, session } = sessionManager.createSession(projectName);
    session.ws = ws;

    // Send session ID to client
    ws.send(JSON.stringify({
      type: 'sessionID',
      sessionID: sessionID
    }));

    // Set up PTY event handlers for new sessions
    sessionManager.setupPtyHandlers(sessionID);

    return sessionID;
  }

  handleWebSocketMessage(message, ptyProcess) {
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
  }

  handleWebSocketClose(sessionID) {
    console.log('Terminal disconnected');
    sessionManager.setSessionTimeout(sessionID);
  }

  handleWebSocketError(error, sessionID) {
    console.error('WebSocket error:', error);
    sessionManager.setSessionTimeout(sessionID);
  }
}

module.exports = WebSocketHandler;