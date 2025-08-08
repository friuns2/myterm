import { h, render } from 'preact';
import { getProjectFromURL, getSessionIDFromURL, updateURLWithSession, clearURLParams, updateURLWithoutSession } from './utils';
import { state } from './state';
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

Object.assign(window as any, {
  h,
  render,
  Dashboard,
  getSessionIDFromURL,
  getProjectFromURL,
  updateURLWithSession,
  clearURLParams,
  updateURLWithoutSession,
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

state.sessionID = getSessionIDFromURL();
state.currentProject = getProjectFromURL();

setupGlobalUI();

if (state.sessionID) {
  initializeTerminal();
} else {
  const terminalContainer = document.getElementById('terminal-container');
  if (terminalContainer) {
    render(<Dashboard />, terminalContainer);
  }
}


