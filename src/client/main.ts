// Entry point to wire up modules and expose required globals for inline handlers
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

// Expose selected functions to window for existing onclick attributes
Object.assign(window as any, {
  // utils
  getSessionIDFromURL,
  getProjectFromURL,
  updateURLWithSession,
  clearURLParams,
  updateURLWithoutSession,
  // terminal
  initializeTerminal,
  cleanupTerminal,
  connectWebSocket,
  // ui
  showNavigationBar,
  hideNavigationBar,
  // projects
  goBackToProjectList,
  goBackToSessionList,
  showSessionsAndProjectsList,
  createNewProject,
  deleteProject,
  selectProject,
  connectToSession,
  killSession,
  // files
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
  // environment & aliases
  showEnvironmentManager,
  showAliasesManager,
  // worktrees
  createWorktreeModal,
  openWorktree,
  mergeWorktree,
  deleteWorktree,
});

// Initialize shared state from URL and choose screen
state.sessionID = getSessionIDFromURL();
state.currentProject = getProjectFromURL();

setupGlobalUI();

if (state.sessionID) initializeTerminal();
else showSessionsAndProjectsList();


