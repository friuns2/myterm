import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { initializeTerminal } from '../terminal';

export function TerminalView() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    initializeTerminal();
  }, []);
  return (
    <div class="flex flex-col h-full">
      <div id="terminal" class="flex-1" ref={ref as any}></div>
    </div>
  );
}


