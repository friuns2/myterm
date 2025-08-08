import { state } from './state';
import { getProjectFromURL, getSessionIDFromURL } from './utils';
import {
  closeFileBrowser,
  closeFileEditor,
  createNewFile,
  createNewFolder,
  handleFileCreation,
  handleFolderCreation,
  toggleFileBrowser,
  saveCurrentFile,
} from './files';
import { initializeTerminal, cleanupTerminal, resizeTerminal, getWebSocket } from './terminal';
import { goBackToProjectList, goBackToSessionList, showSessionsAndProjectsList } from './projects';

export function showNavigationBar(): void {
  const navBar = document.getElementById('nav-bar');
  if (navBar) {
    navBar.classList.remove('hidden');
    const currentPathSpan = document.getElementById('current-path');
    if (currentPathSpan && state.currentProject) {
      currentPathSpan.textContent = `Project: ${state.currentProject}`;
    }
  }
}

export function hideNavigationBar(): void {
  const navBar = document.getElementById('nav-bar');
  navBar?.classList.add('hidden');
}

export function setupGlobalUI(): void {
  window.addEventListener('popstate', () => {
    state.sessionID = getSessionIDFromURL();
    state.currentProject = getProjectFromURL();
    if (state.sessionID) initializeTerminal();
    else showSessionsAndProjectsList();
  });

  document.addEventListener('DOMContentLoaded', () => {
    const backToSessionsBtn = document.getElementById('back-to-sessions');
    const browseFilesBtn = document.getElementById('browse-files');
    const closeBrowserBtn = document.getElementById('close-browser');
    const newFolderBtn = document.getElementById('new-folder');
    const newFileBtn = document.getElementById('new-file');
    const createFileBtn = document.getElementById('create-file-btn');
    const cancelFileBtn = document.getElementById('cancel-file-btn');
    const createFolderBtn = document.getElementById('create-folder-btn');
    const cancelFolderBtn = document.getElementById('cancel-folder-btn');
    const saveFileBtn = document.getElementById('save-file');
    const closeEditorBtn = document.getElementById('close-editor');
    const newFileNameInput = document.getElementById('new-file-name');
    const newFolderNameInput = document.getElementById('new-folder-name');
    const fileContentTextarea = document.getElementById('file-content');
    const fileBrowser = document.getElementById('file-browser');
    const fileEditor = document.getElementById('file-editor');

    backToSessionsBtn?.addEventListener('click', () => {
      cleanupTerminal();
      if (state.currentProject) goBackToProjectList();
      else goBackToSessionList();
    });

    browseFilesBtn?.addEventListener('click', () => void toggleFileBrowser());
    closeBrowserBtn?.addEventListener('click', () => closeFileBrowser());
    newFolderBtn?.addEventListener('click', () => createNewFolder());
    newFileBtn?.addEventListener('click', () => createNewFile());

    createFileBtn?.addEventListener('click', () => void handleFileCreation());
    cancelFileBtn?.addEventListener('click', () => (document.getElementById('new-file-modal') as HTMLDialogElement | null)?.close());
    createFolderBtn?.addEventListener('click', () => void handleFolderCreation());
    cancelFolderBtn?.addEventListener('click', () => (document.getElementById('new-folder-modal') as HTMLDialogElement | null)?.close());

    newFileNameInput?.addEventListener('keypress', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') void handleFileCreation();
    });
    newFolderNameInput?.addEventListener('keypress', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') void handleFolderCreation();
    });

    saveFileBtn?.addEventListener('click', () => void saveCurrentFile());
    closeEditorBtn?.addEventListener('click', () => closeFileEditor());

    fileContentTextarea?.addEventListener('keydown', (event) => {
      const e = event as KeyboardEvent;
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        void saveCurrentFile();
      }
      if (e.key === 'Tab' && event.target instanceof HTMLTextAreaElement) {
        e.preventDefault();
        const start = event.target.selectionStart;
        const end = event.target.selectionEnd;
        const value = event.target.value;
        event.target.value = value.substring(0, start) + '\t' + value.substring(end);
        event.target.selectionStart = event.target.selectionEnd = start + 1;
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (state.isFileEditorOpen) closeFileEditor();
        else if (state.isFileBrowserOpen) closeFileBrowser();
      }
    });

    document.addEventListener('click', (event) => {
      if (
        state.isFileBrowserOpen &&
        fileBrowser &&
        !fileBrowser.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('#browse-files')
      ) {
        closeFileBrowser();
      }
      if (state.isFileEditorOpen && fileEditor && !fileEditor.contains(event.target as Node)) {
        if (!(event.target as HTMLElement).closest('.file-item')) closeFileEditor();
      }
    });

    fileBrowser?.addEventListener('click', (event) => event.stopPropagation());
    fileEditor?.addEventListener('click', (event) => event.stopPropagation());

    setupVirtualKeyboard();
    setupCustomCommandInput();
  });

  const onResize = () => resizeTerminal();
  window.addEventListener('resize', onResize);

  const onVisibilityChange = () => {
    const terminal = (window as any).terminalInstance as any | undefined;
    if (!document.hidden && terminal) {
      terminal.focus?.();
      if (!state.isConnected) {
        const ws = getWebSocket();
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          // reconnect
          (window as any).connectWebSocket?.();
        }
      }
    } else if (document.hidden) {
      const ws = getWebSocket();
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  const customInputContainer = document.getElementById('custom-input-container');
  document.addEventListener('click', (event) => {
    if (customInputContainer && !customInputContainer.contains(event.target as Node)) {
      const t = (window as any).terminalInstance as any | undefined;
      t?.focus?.();
    }
  });

  window.addEventListener('beforeunload', () => cleanupTerminal());
}

export function setupCustomCommandInput(): void {
  const customCommandInput = document.getElementById('custom-command-input') as HTMLTextAreaElement | null;
  if (!customCommandInput) return;
  let commandHistory: string[] = JSON.parse(localStorage.getItem('terminalCommandHistory') || '[]');
  let historyIndex = -1;
  let currentInput = '';
  let suggestionsList: HTMLDivElement | null = null;

  const saveToHistory = (command: string) => {
    if (command && command.trim()) {
      const index = commandHistory.indexOf(command);
      if (index > -1) commandHistory.splice(index, 1);
      commandHistory.unshift(command);
      if (commandHistory.length > 100) commandHistory = commandHistory.slice(0, 100);
      localStorage.setItem('terminalCommandHistory', JSON.stringify(commandHistory));
    }
  };

  const createSuggestionsDropdown = () => {
    suggestionsList?.remove();
    suggestionsList = document.createElement('div');
    suggestionsList.className = 'absolute bottom-full left-0 right-0 bg-base-200 border border-base-300 rounded-t-lg max-h-40 overflow-y-auto z-50 hidden';
    suggestionsList.style.marginBottom = '2px';
    const container = customCommandInput.parentElement as HTMLElement;
    container.style.position = 'relative';
    container.appendChild(suggestionsList);
    return suggestionsList;
  };

  const showSuggestions = (input: string) => {
    if (!suggestionsList) createSuggestionsDropdown();
    const filtered = commandHistory.filter((cmd) => cmd.toLowerCase().includes(input.toLowerCase()) && cmd !== input).slice(0, 5);
    if (filtered.length === 0) {
      suggestionsList!.classList.add('hidden');
      return;
    }
    suggestionsList!.innerHTML = '';
    filtered.forEach((cmd) => {
      const item = document.createElement('div');
      item.className = 'px-3 py-2 cursor-pointer hover:bg-base-300 text-sm';
      item.textContent = cmd;
      item.addEventListener('click', () => {
        customCommandInput.value = cmd;
        suggestionsList!.classList.add('hidden');
        customCommandInput.focus();
      });
      suggestionsList!.appendChild(item);
    });
    suggestionsList!.classList.remove('hidden');
  };

  const hideSuggestions = () => {
    suggestionsList?.classList.add('hidden');
  };

  const sendCommand = () => {
    const ws = getWebSocket();
    const command = (customCommandInput.value || '').trim();
    if (!command || !ws) return;
    saveToHistory(command);
    historyIndex = -1;
    currentInput = '';
    hideSuggestions();
    (window as any).terminalInstance?.focus?.();
    setTimeout(() => {
      if (state.isConnected && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data: command }));
        setTimeout(() => {
          ws.send(JSON.stringify({ type: 'input', data: '\r' }));
        }, 50);
        customCommandInput.value = '';
        customCommandInput.style.height = 'auto';
        customCommandInput.rows = 1;
        setTimeout(() => customCommandInput.focus(), 100);
      }
    }, 50);
  };

  customCommandInput.addEventListener('keydown', (event) => {
    const e = event as KeyboardEvent;
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        setTimeout(() => {
          customCommandInput.style.height = 'auto';
          customCommandInput.style.height = Math.min(customCommandInput.scrollHeight, 120) + 'px';
        }, 0);
      } else {
        e.preventDefault();
        sendCommand();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex === -1) currentInput = customCommandInput.value;
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        customCommandInput.value = commandHistory[historyIndex];
        hideSuggestions();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        customCommandInput.value = commandHistory[historyIndex];
        hideSuggestions();
      } else if (historyIndex === 0) {
        historyIndex = -1;
        customCommandInput.value = currentInput;
        hideSuggestions();
      }
    } else if (e.key === 'Escape') {
      hideSuggestions();
      historyIndex = -1;
      currentInput = '';
    }
  });

  customCommandInput.addEventListener('input', () => {
    customCommandInput.style.height = 'auto';
    customCommandInput.style.height = Math.min(customCommandInput.scrollHeight, 120) + 'px';
    historyIndex = -1;
    currentInput = customCommandInput.value;
    const input = customCommandInput.value.trim();
    if (input.length > 0) showSuggestions(input);
    else hideSuggestions();
  });

  customCommandInput.addEventListener('blur', () => {
    if (!customCommandInput.value.trim()) {
      customCommandInput.style.height = 'auto';
      customCommandInput.rows = 1;
    }
    setTimeout(() => hideSuggestions(), 200);
  });

  customCommandInput.addEventListener('focus', () => {
    const input = customCommandInput.value.trim();
    if (input.length > 0) showSuggestions(input);
  });

  createSuggestionsDropdown();
  document.addEventListener('click', (event) => {
    if (!customCommandInput.contains(event.target as Node) && (!suggestionsList || !suggestionsList.contains(event.target as Node))) {
      hideSuggestions();
    }
  });
}

export function setupVirtualKeyboard(): void {
  const virtualKeyboard = document.getElementById('virtual-keyboard');
  virtualKeyboard?.addEventListener('click', async (event) => {
    const button = (event.target as HTMLElement).closest('button[data-key-code]') as HTMLButtonElement | null;
    if (!button) return;
    const keyCode = parseInt(button.dataset.keyCode || '0', 10);
    let data = '';
    switch (keyCode) {
      case 27:
        data = '\x1B';
        break;
      case 9:
        data = '\x09';
        break;
      case 17: {
        const res = await (window as any).Swal.fire({
          title: 'Ctrl Key Combination',
          input: 'text',
          inputLabel: 'Enter next key for Ctrl combination',
          inputPlaceholder: "e.g., 'c' for Ctrl+C, 'z' for Ctrl+Z",
          showCancelButton: true,
          inputValidator: (value: string) => (!value ? 'You need to enter a key!' : undefined),
        });
        const nextKey = res.value as string | undefined;
        if (nextKey) {
          const charCode = nextKey.toLowerCase().charCodeAt(0);
          if (charCode >= 97 && charCode <= 122) data = String.fromCharCode(charCode - 96);
          else if (nextKey === '[') data = '\x1B';
          else if (nextKey === '\\') data = '\x1C';
          else if (nextKey === ']') data = '\x1D';
          else if (nextKey === '^') data = '\x1E';
          else if (nextKey === '_') data = '\x1F';
        }
        break;
      }
      case 3:
        data = '\x03';
        break;
      case 38:
        data = '\x1B[A';
        break;
      case 40:
        data = '\x1B[B';
        break;
      case 37:
        data = '\x1B[D';
        break;
      case 39:
        data = '\x1B[C';
        break;
      default:
        break;
    }
    const ws = getWebSocket();
    if (state.isConnected && data && ws) {
      (window as any).terminalInstance?.focus?.();
      setTimeout(() => ws.send(JSON.stringify({ type: 'input', data })), 50);
    }
  });
}


