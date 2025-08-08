import { Signal, signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { currentProjectSignal, sessionIdSignal, clearUrlParams } from './state';
import { NavBar } from './NavBar';
import { TerminalView } from './TerminalView';
import { Dashboard } from './Dashboard';
import { Settings } from './Settings';
import { CustomCommand } from './CustomCommand';
import { FileBrowser } from './FileBrowser';
import { FileEditor } from './FileEditor';
import { isFileBrowserOpenSignal } from './state';

type View = 'dashboard' | 'terminal' | 'settings';
const viewSignal: Signal<View> = signal('dashboard');

export function App() {
  useEffect(() => {
    // Init view from URL
    if (sessionIdSignal.value || currentProjectSignal.value) {
      viewSignal.value = 'terminal';
    } else {
      viewSignal.value = 'dashboard';
    }
    window.addEventListener('popstate', () => {
      // very simple handling: if session present -> terminal else dashboard
      viewSignal.value = (new URLSearchParams(window.location.search).get('session')) ? 'terminal' : 'dashboard';
    });
  }, []);

  const goDashboard = () => {
    clearUrlParams();
    viewSignal.value = 'dashboard';
  };

  const openTerminal = () => {
    viewSignal.value = 'terminal';
  };

  const openSettings = () => {
    viewSignal.value = 'settings';
  };

  return (
    <div class="flex-1 flex flex-col h-full">
      {viewSignal.value === 'terminal' && (
        <>
          <NavBar onBack={goDashboard} onBrowse={() => { isFileBrowserOpenSignal.value = !isFileBrowserOpenSignal.value; }} />
          <div class="flex-1 flex overflow-hidden">
            <TerminalView />
            <FileBrowser />
            <FileEditor />
          </div>
          <CustomCommand
            send={(data) => {
              // Global WS is inside TerminalView; simulate by dispatching custom event consumed by TerminalView
              window.dispatchEvent(new CustomEvent('terminal-send', { detail: data }));
            }}
            isConnected={() => true}
          />
        </>
      )}

      {viewSignal.value === 'dashboard' && (
        <Dashboard onConnect={openTerminal} onOpenSettings={openSettings} onOpenWorktree={(project, worktree) => {
          sessionIdSignal.value = null;
          currentProjectSignal.value = `${project}/worktrees/${worktree}`;
          openTerminal();
        }} />
      )}

      {viewSignal.value === 'settings' && (
        <Settings onBack={() => { viewSignal.value = 'dashboard'; }} />
      )}
    </div>
  );
}


