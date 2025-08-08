import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { sessionID, currentProject, isConnected } from './state';
import { updateURLWithSession } from './utils';

let terminal: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let ws: WebSocket | null = null;

let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY_MS = 1000;

function cleanupWebSocket(): void {
  if (ws) {
    ws.onopen = null;
    ws.onmessage = null;
    ws.onclose = null;
    ws.onerror = null;
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
    ws = null;
  }
  isConnected.value = false;
  reconnectAttempts = 0;
}

export function cleanupTerminal(): void {
  cleanupWebSocket();
  if (terminal) {
    terminal.dispose();
    terminal = null;
  }
  fitAddon = null;
}

export function getTerminal(): Terminal | null {
  return terminal;
}

export function connectWebSocket(): void {
  cleanupWebSocket();

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  let url = `${protocol}//${window.location.host}`;

  const params = new URLSearchParams();
  if (sessionID.value) params.append('sessionID', sessionID.value);
  if (currentProject.value) params.append('projectName', currentProject.value);
  if (params.toString()) url += `?${params.toString()}`;

  ws = new WebSocket(url);

  ws.onopen = () => {
    isConnected.value = true;
    reconnectAttempts = 0;
    if (terminal && sessionID.value) {
      // Force redraw after reconnect
      // @ts-expect-error xterm private API exists in runtime
      terminal.clearTextureAtlas?.();
      terminal.refresh(0, (terminal.rows || 1) - 1);
    }
    if (terminal && ws) {
      ws.send(
        JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows })
      );
    }
  };

  ws.onmessage = (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case 'output':
          terminal?.write(message.data);
          break;
        case 'sessionID':
          sessionID.value = message.sessionID;
          updateURLWithSession(message.sessionID, currentProject.value);
          break;
        case 'exit':
          terminal?.write(`\r\nProcess exited with code: ${message.exitCode}\r\n`);
          terminal?.write('Connection closed. Go back to session list.\r\n');
          isConnected.value = false;
          break;
        default:
          // ignore
          break;
      }
    } catch (e) {
      console.error('Error parsing message:', e);
    }
  };

  ws.onclose = () => {
    isConnected.value = false;
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttempts);
      reconnectAttempts++;
      terminal?.write(`\r\nConnection lost. Attempting to reconnect...\r\n`);
      setTimeout(connectWebSocket, delay);
    } else {
      terminal?.write('\r\nConnection lost. Max reconnect attempts reached. Go back to session list.\r\n');
    }
  };

  ws.onerror = () => {
    terminal?.write('\r\nWebSocket error occurred. Attempting to reconnect.\r\n');
    ws?.close();
  };
}

export function initializeTerminal(): void {
  const container = document.getElementById('terminal-container');
  if (!container) return;
  container.innerHTML = `
    <div class="flex flex-col h-full">
      <div id="terminal" class="flex-1"></div>
    </div>
  `;

  if (terminal) terminal.dispose();
  terminal = new Terminal({
    cursorBlink: true,
    fontFamily: 'Courier New, monospace',
    fontSize: 14,
    theme: {
      background: '#000000',
      foreground: '#00ff00',
      cursor: '#00ff00',
      cursorAccent: '#000000',
      selection: 'rgba(0, 255, 0, 0.3)'
    },
    allowTransparency: false
  });

  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  const element = document.getElementById('terminal');
  if (!element) return;
  terminal.open(element);
  fitAddon.fit();

  terminal.onData((data) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', data }));
    }
  });

  terminal.focus();
  connectWebSocket();

  const showNavigationBar = (window as any).showNavigationBar as (() => void) | undefined;
  if (showNavigationBar) showNavigationBar();
}

export function resizeTerminal(): void {
  if (fitAddon) fitAddon.fit();
  if (state.isConnected && terminal && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }));
  }
}

export function getWebSocket(): WebSocket | null {
  return ws;
}


