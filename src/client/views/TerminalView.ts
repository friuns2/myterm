import { html } from 'uhtml';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

type Props = {
  session: string | null;
  project: string | null;
  onBack: () => void;
};

let terminal: any = null;
let fitAddon: any = null;
let ws: WebSocket | null = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY = 1000;


export function renderTerminalView(props: Props) {
  setTimeout(() => {
    mountTerminal(props);
  }, 0);

  return html`<div class="flex flex-col h-full">
    <div class="bg-base-200 p-2 border-b border-base-300">
      <div class="flex gap-2 items-center flex-wrap">
        <button class="btn btn-sm btn-outline" onclick=${props.onBack}>← Back to Sessions</button>
        <span class="text-sm opacity-70">${props.project ? `Project: ${props.project}` : ''}</span>
      </div>
    </div>
    <div class="flex-1 flex overflow-hidden">
      <div id="terminal" class="flex-1"></div>
    </div>
    ${VirtualKeyboard()}
  </div>`;
}

function createTerminal() {
  if (terminal) terminal.dispose();
  terminal = new Terminal({
    cursorBlink: true,
    fontFamily: 'Courier New, monospace',
    fontSize: 14,
    theme: { background: '#000000', foreground: '#00ff00', cursor: '#00ff00', cursorAccent: '#000000', selection: 'rgba(0, 255, 0, 0.3)' },
    allowTransparency: false
  });
  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
}

function mountTerminal(props: Props) {
  const el = document.getElementById('terminal');
  if (!el) return;
  if (!terminal) createTerminal();
  terminal.open(el);
  fitAddon.fit();
  terminal.onData((data: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', data }));
    }
  });
  connectWebSocket(props);
  window.addEventListener('resize', () => {
    if (fitAddon) fitAddon.fit();
    if (isConnected && terminal && ws) {
      ws.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }));
    }
  });
}

function connectWebSocket(props: Props) {
  cleanupWebSocket();
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  let url = `${protocol}//${window.location.host}`;
  const params = new URLSearchParams();
  if (props.session) params.append('sessionID', props.session);
  if (props.project) params.append('projectName', props.project);
  if (params.toString()) url += `?${params.toString()}`;
  ws = new WebSocket(url);
  ws.onopen = () => {
    isConnected = true; reconnectAttempts = 0;
    ws!.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }));
  };
  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case 'output': terminal.write(message.data); break;
        case 'sessionID': /* eslint-disable-next-line */ (props as any).session = message.sessionID; break;
        case 'exit': terminal.write(`\r\nProcess exited with code: ${message.exitCode}\r\n`); terminal.write('Connection closed. Go back to session list.\r\n'); isConnected = false; break;
        default: break;
      }
    } catch (e) { console.error('Error parsing message', e); }
  };
  ws.onclose = () => {
    isConnected = false;
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts);
      reconnectAttempts++;
      terminal.write(`\r\nConnection lost. Attempting to reconnect...\r\n`);
      setTimeout(() => connectWebSocket(props), delay);
    } else {
      terminal.write('\r\nConnection lost. Max reconnect attempts reached. Go back to session list.\r\n');
    }
  };
  ws.onerror = (err) => {
    console.error('WebSocket error', err);
    terminal.write('\r\nWebSocket error occurred. Attempting to reconnect.\r\n');
    ws?.close();
  };
}

function cleanupWebSocket() {
  if (ws) {
    ws.onopen = null; ws.onmessage = null; ws.onclose = null; ws.onerror = null;
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
    ws = null;
  }
  isConnected = false; reconnectAttempts = 0;
}

export function cleanupTerminal() {
  cleanupWebSocket();
  if (terminal) { terminal.dispose(); terminal = null; }
  fitAddon = null;
}

function VirtualKeyboard() {
  const send = (data: string) => {
    if (isConnected && ws) ws.send(JSON.stringify({ type: 'input', data }));
  };
  const ctrlCombo = async () => {
    const nextKey = prompt("Enter next key for Ctrl combination (e.g. 'c' for Ctrl+C)");
    if (!nextKey) return;
    const charCode = nextKey.toLowerCase().charCodeAt(0);
    if (charCode >= 97 && charCode <= 122) send(String.fromCharCode(charCode - 96));
  };
  return html`<div class="bg-base-200 p-2 border-t border-base-300">
    <div class="flex gap-2 justify-center items-center flex-wrap">
      <textarea id="custom-command-input" placeholder="Enter command... (Shift+Enter for new line, Enter to send)"
        class="textarea textarea-bordered textarea-xs bg-base-100 text-sm flex-1 min-w-0 max-w-xs resize-none" rows="1"
        onkeydown=${(e: KeyboardEvent) => {
          const ta = e.target as HTMLTextAreaElement;
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const command = ta.value.trim();
            if (command && isConnected && ws) {
              ws.send(JSON.stringify({ type: 'input', data: command }));
              setTimeout(() => ws!.send(JSON.stringify({ type: 'input', data: '\r' })), 50);
              ta.value = '';
            }
          }
        }}
      ></textarea>
      <button class="btn btn-xs btn-outline" onclick=${() => send('\x1B')}>Esc</button>
      <button class="btn btn-xs btn-outline" onclick=${() => send('\x09')}>Tab</button>
      <button class="btn btn-xs btn-outline" onclick=${ctrlCombo}>Ctrl</button>
      <button class="btn btn-xs btn-outline" onclick=${() => send('\x1B[A')}>↑</button>
      <button class="btn btn-xs btn-outline" onclick=${() => send('\x1B[D')}>←</button>
      <button class="btn btn-xs btn-outline" onclick=${() => send('\x1B[B')}>↓</button>
      <button class="btn btn-xs btn-outline" onclick=${() => send('\x1B[C')}>→</button>
    </div>
  </div>`;
}


