import { useEffect, useRef } from 'preact/hooks';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { signal } from '@preact/signals';
import { currentProjectSignal, sessionIdSignal, updateUrlWithSession } from './state';

const isConnectedSignal = signal(false);
const reconnectAttemptsSignal = signal(0);

const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY = 1000;

export function TerminalView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const term = new Terminal({
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
    const fit = new FitAddon();
    term.loadAddon(fit);

    termRef.current = term;
    fitRef.current = fit;

    if (containerRef.current) {
      term.open(containerRef.current);
      fit.fit();
    }

    const onData = term.onData((data) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    const connect = () => {
      // cleanup existing
      const existing = wsRef.current;
      if (existing) {
        try { existing.close(); } catch {}
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let url = `${protocol}//${window.location.host}/ws`;
      const params = new URLSearchParams();
      if (sessionIdSignal.value) params.append('sessionID', sessionIdSignal.value);
      if (currentProjectSignal.value) params.append('projectName', currentProjectSignal.value);
      if (params.toString()) url += `?${params.toString()}`;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        isConnectedSignal.value = true;
        reconnectAttemptsSignal.value = 0;
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          switch (message.type) {
            case 'output':
              term.write(message.data);
              break;
            case 'sessionID':
              sessionIdSignal.value = message.sessionID;
              updateUrlWithSession(message.sessionID, currentProjectSignal.value);
              break;
            case 'error':
              term.writeln(`\r\nError: ${message.message}\r\nUse Back to Sessions to return.`);
              isConnectedSignal.value = false;
              reconnectAttemptsSignal.value = MAX_RECONNECT_ATTEMPTS; // stop
              try { ws.close(); } catch {}
              break;
            case 'exit':
              term.writeln(`\r\nProcess exited with code: ${message.exitCode}\r\nConnection closed. Go back to session list.`);
              isConnectedSignal.value = false;
              break;
            default:
              // ignore
              break;
          }
        } catch (e) {
          // ignore
        }
      };

      ws.onclose = () => {
        isConnectedSignal.value = false;
        const attempts = reconnectAttemptsSignal.value;
        if (attempts < MAX_RECONNECT_ATTEMPTS) {
          const delay = RECONNECT_BASE_DELAY * Math.pow(2, attempts);
          reconnectAttemptsSignal.value = attempts + 1;
          term.writeln(`\r\nConnection lost. Attempting to reconnect...`);
          setTimeout(connect, delay);
        } else {
          term.writeln(`\r\nConnection lost. Max reconnect attempts reached.`);
        }
      };

      ws.onerror = () => {
        term.writeln(`\r\nWebSocket error occurred. Attempting to reconnect.`);
        try { ws.close(); } catch {}
      };
    };

    connect();

    const onExternalSend = (ev: Event) => {
      const detail = (ev as CustomEvent<string>).detail;
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data: detail }));
      }
    };
    window.addEventListener('terminal-send', onExternalSend as EventListener);

    const onResize = () => {
      if (fitRef.current) fitRef.current.fit();
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    };
    window.addEventListener('resize', onResize);

    const onBeforeUnload = () => {
      try { wsRef.current?.close(); } catch {}
      term.dispose();
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      onData.dispose();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('terminal-send', onExternalSend as EventListener);
      window.removeEventListener('beforeunload', onBeforeUnload);
      try { wsRef.current?.close(); } catch {}
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []);

  return (
    <div class="flex-1 bg-black p-2 overflow-hidden">
      <div ref={containerRef} class="w-full h-full" />
    </div>
  );
}


