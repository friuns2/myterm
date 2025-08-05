// WebSocket communication module for terminal sessions

import { getURLParameter, updateURLParameters } from './utils.js';
import { writeToTerminal, getTerminalDimensions, refreshTerminal } from './terminal.js';

// WebSocket state
let ws = null;
let sessionID = getURLParameter('session');
let currentProject = getURLParameter('project') || null;
let isConnected = false;
let reconnectAttempts = 0;

// Constants
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY = 1000; // 1 second

// Event callbacks
let onSessionIDReceived = null;
let onConnectionStatusChanged = null;

/**
 * Set up event callbacks
 * @param {Object} callbacks - Object containing callback functions
 */
export function setWebSocketCallbacks(callbacks) {
    if (callbacks.onSessionIDReceived) {
        onSessionIDReceived = callbacks.onSessionIDReceived;
    }
    if (callbacks.onConnectionStatusChanged) {
        onConnectionStatusChanged = callbacks.onConnectionStatusChanged;
    }
}

/**
 * Get current session ID
 * @returns {string|null} - Current session ID
 */
export function getSessionID() {
    return sessionID;
}

/**
 * Get current project
 * @returns {string|null} - Current project name
 */
export function getCurrentProject() {
    return currentProject;
}

/**
 * Set current project
 * @param {string} project - Project name
 */
export function setCurrentProject(project) {
    currentProject = project;
}

/**
 * Check if WebSocket is connected
 * @returns {boolean} - Connection status
 */
export function isWebSocketConnected() {
    return isConnected;
}

/**
 * Connect to WebSocket server
 * @param {string} sessionId - Optional session ID to connect to
 * @param {string} project - Optional project name
 */
export function connectWebSocket(sessionId = null, project = null) {
    if (sessionId) {
        sessionID = sessionId;
    }
    if (project) {
        currentProject = project;
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let url = `${protocol}//${window.location.host}`;
    
    const params = new URLSearchParams();
    if (sessionID) {
        params.append('sessionID', sessionID);
    }
    if (currentProject) {
        params.append('projectName', currentProject);
    }
    
    if (params.toString()) {
        url += `?${params.toString()}`;
    }
    
    // Close existing connection
    if (ws) {
        ws.close();
    }
    
    ws = new WebSocket(url);
    
    ws.onopen = handleWebSocketOpen;
    ws.onmessage = handleWebSocketMessage;
    ws.onclose = handleWebSocketClose;
    ws.onerror = handleWebSocketError;
}

/**
 * Send data to WebSocket
 * @param {Object} data - Data to send
 */
export function sendWebSocketData(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    } else {
        console.warn('WebSocket not connected, cannot send data:', data);
    }
}

/**
 * Send terminal input
 * @param {string} input - Input data
 */
export function sendTerminalInput(input) {
    sendWebSocketData({
        type: 'input',
        data: input
    });
}

/**
 * Send terminal resize information
 */
export function sendTerminalResize() {
    const dimensions = getTerminalDimensions();
    sendWebSocketData({
        type: 'resize',
        cols: dimensions.cols,
        rows: dimensions.rows
    });
}

/**
 * Disconnect WebSocket
 */
export function disconnectWebSocket() {
    reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Prevent reconnection
    if (ws) {
        ws.close();
    }
}

/**
 * Update URL with session information
 * @param {string} sessionId - Session ID
 * @param {string} project - Project name
 */
export function updateURLWithSession(sessionId, project = null) {
    const params = { session: sessionId };
    if (project) {
        params.project = project;
    }
    updateURLParameters(params);
}

/**
 * Update URL with project information
 * @param {string} project - Project name
 */
export function updateURLWithProject(project) {
    updateURLParameters({ project: project, session: null });
}

// WebSocket event handlers

function handleWebSocketOpen() {
    console.log('Connected to terminal');
    isConnected = true;
    reconnectAttempts = 0; // Reset reconnect attempts on successful connection
    
    // Notify about connection status change
    if (onConnectionStatusChanged) {
        onConnectionStatusChanged(true);
    }
    
    // Force screen refresh on reconnection
    if (sessionID) {
        refreshTerminal();
    }
    
    // Send initial terminal size
    sendTerminalResize();
}

function handleWebSocketMessage(event) {
    try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
            case 'output':
                // Write PTY output to terminal
                writeToTerminal(message.data);
                break;
            
            case 'sessionID':
                // Store session ID received from server
                sessionID = message.sessionID;
                updateURLWithSession(sessionID, currentProject);
                console.log(`Received new session ID: ${sessionID}`);
                
                // Notify about new session ID
                if (onSessionIDReceived) {
                    onSessionIDReceived(sessionID);
                }
                break;
                
            case 'exit':
                writeToTerminal(`\r\nProcess exited with code: ${message.exitCode}\r\n`);
                writeToTerminal('Connection closed. Go back to session list.\r\n');
                isConnected = false;
                
                // Notify about connection status change
                if (onConnectionStatusChanged) {
                    onConnectionStatusChanged(false);
                }
                break;
                
            default:
                console.log('Unknown message type:', message.type);
        }
    } catch (error) {
        console.error('Error parsing WebSocket message:', error);
    }
}

function handleWebSocketClose() {
    console.log('WebSocket connection closed');
    isConnected = false;
    
    // Notify about connection status change
    if (onConnectionStatusChanged) {
        onConnectionStatusChanged(false);
    }
    
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts);
        reconnectAttempts++;
        console.log(`Attempting to reconnect in ${delay / 1000} seconds... (Attempt ${reconnectAttempts})`);
        writeToTerminal(`\r\nConnection lost. Attempting to reconnect...\r\n`);
        setTimeout(() => connectWebSocket(), delay);
    } else {
        writeToTerminal('\r\nConnection lost. Max reconnect attempts reached. Go back to session list.\r\n');
    }
}

function handleWebSocketError(error) {
    console.error('WebSocket error:', error);
    writeToTerminal('\r\nWebSocket error occurred. Attempting to reconnect.\r\n');
    
    // Force close to trigger onclose and reconnect logic
    if (ws) {
        ws.close();
    }
} 