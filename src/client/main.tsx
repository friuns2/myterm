import { h, render } from 'preact';
import { getProjectFromURL, getSessionIDFromURL, getViewFromURL, updateURLWithSession, clearURLParams, updateURLWithoutSession, updateURLForView } from './utils';
import { currentProject, sessionID, currentView } from './state';
import { initializeTerminal, cleanupTerminal, connectWebSocket } from './terminal';
import { showNavigationBar, hideNavigationBar, setupGlobalUI } from './ui';
import {
  goBackToProjectList,
  goBackToSessionList,
  showSessionsAndProjectsList,
  createNewProject,
  deleteProject,
  selectProject,
  connectToSession,
  killSession
} from './projects';
import {
  toggleFileBrowser,
  loadDirectory,
  openFileInEditor,
  saveCurrentFile,
  closeFileBrowser,
  closeFileEditor,
  createNewFile,
  createNewFolder,
  handleFileCreation,
  handleFolderCreation,
} from './files';
import { showEnvironmentManager } from './environment';
import { showAliasesManager } from './aliases';
import { createWorktreeModal, openWorktree, mergeWorktree, deleteWorktree } from './worktrees';
import { Dashboard } from './components/Dashboard';
import { Environment } from './components/Environment';
import { Aliases } from './components/Aliases';
import { TerminalView } from './components/TerminalView';

Object.assign(window as any, {
  h,
  render,
  Dashboard,
  Environment,
  Aliases,
  TerminalView,
  getSessionIDFromURL,
  getProjectFromURL,
  updateURLWithSession,
  clearURLParams,
  updateURLWithoutSession,
  updateURLForView,
  initializeTerminal,
  cleanupTerminal,
  connectWebSocket,
  showNavigationBar,
  hideNavigationBar,
  goBackToProjectList,
  goBackToSessionList,
  showSessionsAndProjectsList,
  createNewProject,
  deleteProject,
  selectProject,
  connectToSession,
  killSession,
  toggleFileBrowser,
  loadDirectory,
  openFileInEditor,
  saveCurrentFile,
  closeFileBrowser,
  closeFileEditor,
  createNewFile,
  createNewFolder,
  handleFileCreation,
  handleFolderCreation,
  showEnvironmentManager,
  showAliasesManager,
  createWorktreeModal,
  openWorktree,
  mergeWorktree,
  deleteWorktree,
});

sessionID.value = getSessionIDFromURL();
currentProject.value = getProjectFromURL();
currentView.value = getViewFromURL();

setupGlobalUI();

const container = document.getElementById('terminal-container');
const renderByView = () => {
  if (!container) return;
  container.innerHTML = '';
  if (sessionID.value) {
    render(<TerminalView />, container);
    return;
  }
  switch (currentView.value) {
    case 'environment':
      render(<Environment />, container);
      break;
    case 'aliases':
      render(<Aliases />, container);
      break;
    case 'dashboard':
    default:
      render(<Dashboard />, container);
      break;
  }
};

renderByView();

window.addEventListener('popstate', () => {
  sessionID.value = getSessionIDFromURL();
  currentProject.value = getProjectFromURL();
  currentView.value = getViewFromURL();
  renderByView();
});


