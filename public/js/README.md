# JavaScript Modules Structure

The original `script.js` file has been split into multiple modular JavaScript files for better organization and maintainability.

## Module Overview

### Core Modules

1. **`main.js`** - Main application initialization and coordination
   - Initializes all modules
   - Manages global state
   - Handles URL-based routing

2. **`utils.js`** - Utility functions
   - `stripAnsiCodes()` - Removes ANSI escape sequences
   - `ansiToHtml()` - Converts ANSI codes to HTML

3. **`url-utils.js`** - URL parameter management
   - `getSessionIdFromURL()` - Extracts session ID from URL
   - `getProjectFromURL()` - Extracts project name from URL
   - `updateURLWithSession()` - Updates URL with session info
   - `updateURLWithProject()` - Updates URL with project info

### Terminal & Communication

4. **`terminal.js`** - Terminal management
   - `createNewTerminal()` - Creates new xterm.js instance
   - `initializeTerminal()` - Initializes terminal with WebSocket
   - `handleResize()` - Handles terminal resizing

5. **`websocket.js`** - WebSocket communication
   - `connectWebSocket()` - Establishes WebSocket connection
   - `sendWebSocketData()` - Sends data through WebSocket
   - Connection state management and reconnection logic

### Project & Session Management

6. **`project-manager.js`** - Project and session operations
   - `showSessionsAndProjectsList()` - Displays main dashboard
   - `showProjectList()` - Shows available projects
   - `createNewProject()` - Creates new projects
   - `showProjectSessions()` - Shows project-specific sessions
   - Session management functions

7. **`worktree-manager.js`** - Git worktree operations
   - `createWorktreeModal()` - Shows worktree creation dialog
   - `openWorktree()` - Opens terminal in worktree
   - `mergeWorktree()` - Merges and deletes worktree
   - `deleteWorktree()` - Deletes worktree

### File Operations

8. **`file-browser.js`** - File system navigation
   - `toggleFileBrowser()` - Shows/hides file browser
   - `loadDirectory()` - Loads directory contents
   - `createNewFile()` / `createNewFolder()` - File/folder creation
   - Directory navigation and file operations

9. **`file-editor.js`** - File editing functionality
   - `openFileInEditor()` - Opens files for editing
   - `saveCurrentFile()` - Saves file changes
   - `closeFileEditor()` - Closes editor panel

### Event Management

10. **`event-handlers.js`** - Global event handling
    - Window resize handlers
    - Keyboard shortcuts
    - UI event listeners
    - Virtual keyboard setup

## Module Dependencies

The modules are loaded in this order in `index.html`:

1. `utils.js` - No dependencies
2. `url-utils.js` - No dependencies
3. `websocket.js` - Uses utils
4. `terminal.js` - Uses websocket and utils
5. `project-manager.js` - Uses url-utils
6. `file-browser.js` - No dependencies
7. `file-editor.js` - No dependencies
8. `worktree-manager.js` - Uses project-manager and url-utils
9. `event-handlers.js` - Uses all other modules
10. `main.js` - Coordinates all modules

## Global Variables

The following global variables are maintained for compatibility:
- `window.term` - Current terminal instance
- `window.socket` - WebSocket connection
- `window.sessionID` - Current session ID
- `window.currentProject` - Current project name
- `window.isFileBrowserOpen` - File browser state

## Module Exports

Each module exports its functions via `window.[moduleName]` for inter-module communication:
- `window.terminalModule`
- `window.webSocketModule`
- `window.urlUtils`
- `window.utils`
- `window.projectManager`
- `window.fileBrowser`
- `window.fileEditor`
- `window.worktreeManager`
- `window.eventHandlers`
- `window.app`

Functions that need to be called from HTML onclick handlers are also made globally available.