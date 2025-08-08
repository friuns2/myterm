import { signal } from '@preact/signals';

export function CustomCommand(props: { send: (data: string) => void; isConnected: () => boolean }) {
  const valueSignal = signal('');
  const historySignal = signal<string[]>(JSON.parse(localStorage.getItem('terminalCommandHistory') || '[]'));
  const historyIndexSignal = signal(-1);
  const currentInputSignal = signal('');

  const saveToHistory = (cmd: string) => {
    if (!cmd.trim()) return;
    const arr = [...historySignal.value];
    const idx = arr.indexOf(cmd);
    if (idx > -1) arr.splice(idx, 1);
    arr.unshift(cmd);
    if (arr.length > 100) arr.splice(100);
    historySignal.value = arr;
    localStorage.setItem('terminalCommandHistory', JSON.stringify(arr));
  };

  const send = () => {
    const cmd = valueSignal.value.trim();
    if (!cmd) return;
    saveToHistory(cmd);
    historyIndexSignal.value = -1;
    currentInputSignal.value = '';
    if (props.isConnected()) {
      props.send(cmd);
      setTimeout(() => props.send('\r'), 50);
      valueSignal.value = '';
    }
  };

  return (
    <div id="virtual-keyboard" class="bg-base-200 p-2 border-t border-base-300">
      <div class="flex gap-2 justify-center items-center flex-wrap">
        <textarea
          id="custom-command-input"
          placeholder="Enter command... (Shift+Enter for new line, Enter to send)"
          class="textarea textarea-bordered textarea-xs bg-base-100 text-sm flex-1 min-w-0 max-w-xs resize-none"
          rows={1}
          value={valueSignal.value}
          onInput={(e) => (valueSignal.value = (e.currentTarget as HTMLTextAreaElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (e.shiftKey) {
                // auto-resize handled by browser
              } else {
                e.preventDefault();
                send();
              }
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              if (historyIndexSignal.value === -1) currentInputSignal.value = valueSignal.value;
              if (historyIndexSignal.value < historySignal.value.length - 1) {
                historyIndexSignal.value++;
                valueSignal.value = historySignal.value[historyIndexSignal.value];
              }
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (historyIndexSignal.value > 0) {
                historyIndexSignal.value--;
                valueSignal.value = historySignal.value[historyIndexSignal.value];
              } else if (historyIndexSignal.value === 0) {
                historyIndexSignal.value = -1;
                valueSignal.value = currentInputSignal.value;
              }
            }
          }}
        />
        <button class="btn btn-xs btn-outline" onClick={() => props.send('\x1B')}>Esc</button>
        <button class="btn btn-xs btn-outline" onClick={() => props.send('\x09')}>Tab</button>
        <button class="btn btn-xs btn-outline" onClick={() => props.send('\x03')}>Ctrl+C</button>
        <button class="btn btn-xs btn-outline" onClick={() => props.send('\x1B[A')}>↑</button>
        <button class="btn btn-xs btn-outline" onClick={() => props.send('\x1B[D')}>←</button>
        <button class="btn btn-xs btn-outline" onClick={() => props.send('\x1B[B')}>↓</button>
        <button class="btn btn-xs btn-outline" onClick={() => props.send('\x1B[C')}>→</button>
      </div>
    </div>
  );
}


