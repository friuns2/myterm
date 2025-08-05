// Initialize xterm.js terminal
const { Terminal } = window;
const { FitAddon } = window.FitAddon;

// Global variables for current terminal instance
let terminal = null;
let fitAddon = null;

// Function to create a new terminal instance
function createNewTerminal() {
    // Dispose of existing terminal if it exists
    if (terminal) {
        terminal.dispose();
    }
    
    // Create new terminal instance
    terminal = new Terminal({
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
    
    // Create new fit addon
    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    
    return terminal;
}

// Initial terminal instance will be created when needed

// File browser and editor state
let currentBrowserPath = null;
let currentEditingFile = null;
let isFileBrowserOpen = false;
let isFileEditorOpen = false;

// Function to strip ANSI escape sequences from text
function stripAnsiCodes(text) {
    // Remove ANSI escape sequences
    return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

// Function to convert ANSI escape sequences to HTML
function ansiToHtml(text) {
    // Basic ANSI color codes mapping
    const ansiColors = {
        '30': 'color: #000000', // black
        '31': 'color: #ff0000', // red
        '32': 'color: #00ff00', // green
        '33': 'color: #ffff00', // yellow
        '34': 'color: #0000ff', // blue
        '35': 'color: #ff00ff', // magenta
        '36': 'color: #00ffff', // cyan
        '37': 'color: #ffffff', // white
        '90': 'color: #808080', // bright black (gray)
        '91': 'color: #ff8080', // bright red
        '92': 'color: #80ff80', // bright green
        '93': 'color: #ffff80', // bright yellow
        '94': 'color: #8080ff', // bright blue
        '95': 'color: #ff80ff', // bright magenta
        '96': 'color: #80ffff', // bright cyan
        '97': 'color: #ffffff'  // bright white
    };
    
    let result = text;
    let openSpans = 0;
    
    // Handle 256-color sequences like [38;2;r;g;b;m
    result = result.replace(/\x1b\[38;2;(\d+);(\d+);(\d+)m/g, (match, r, g, b) => {
        openSpans++;
        return `<span style="color: rgb(${r}, ${g}, ${b})">`;
    });
    
    // Handle basic color codes
    result = result.replace(/\x1b\[(\d+)m/g, (match, code) => {
        if (code === '0' || code === 'm') {
            // Reset - close all spans
            const closeSpans = '</span>'.repeat(openSpans);
            openSpans = 0;
            return closeSpans;
        }
        if (ansiColors[code]) {
            openSpans++;
            return `<span style="${ansiColors[code]}">`;
        }
        return ''; // Remove unhandled codes
    });
    
    // Remove any remaining ANSI sequences
    result = result.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    
    // Close any remaining open spans
    result += '</span>'.repeat(openSpans);
    
    return result;
}

let ws;
let sessionID = getSessionIDFromURL(); // Get session ID from URL only
let currentProject = getProjectFromURL() || null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY = 1000; // 1 second

// Function to get session ID from URL parameters
function getSessionIDFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('session');
}

function getProjectFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('project');
}

// Function to update URL with session ID using pushState for navigation history
function updateURLWithSession(sessionId, projectName = null) {
    const url = new URL(window.location);
    url.searchParams.set('session', sessionId);
    if (projectName) {
        url.searchParams.set('project', projectName);
    }
    window.history.pushState({ sessionId: sessionId }, '', url);
}

function updateURLWithProject(projectName) {
    const url = new URL(window.location);
    url.searchParams.delete('session');
    url.searchParams.set('project', projectName);
    window.history.pushState({ project: projectName }, '', url);
}

function clearURLParams() {
    const url = new URL(window.location);
    url.searchParams.delete('session');
    url.searchParams.delete('project');
    window.history.pushState({}, '', url);
}

// Function to navigate back to session list
function goBackToSessionList() {
    const url = new URL(window.location);
    url.searchParams.delete('session');
    window.history.pushState({ sessionList: true }, '', url);
    if (currentProject) {
        showProjectSessions(currentProject);
    } else {
        showProjectList();
    }
}

function goBackToProjectList() {
    clearURLParams();
    currentProject = null;
    sessionID = null;
    showProjectList();
}

const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let url = `${protocol}//${window.location.host}`;
    
    const params = new URLSearchParams();
    if (sessionID) {
        params.append('sessionID', sessionID);
    }
    if (currentProject) {
        params.append('projectName', currentProject);
    }
    
    if (params.toString()) {
        url += `?${params.toString()}`;
    }
    
    ws = new WebSocket(url);

    ws.onopen = () => {
        console.log('Connected to terminal');
        isConnected = true;
        reconnectAttempts = 0; // Reset reconnect attempts on successful connection
        
        // Force screen refresh on reconnection
        if (sessionID) {
            // Clear texture atlas to force redraw
            terminal.clearTextureAtlas();
            // Refresh the entire terminal display
            terminal.refresh(0, terminal.rows - 1);
        }
        
        // Send initial terminal size
        ws.send(JSON.stringify({
            type: 'resize',
            cols: terminal.cols,
            rows: terminal.rows
        }));
    };

    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            
            switch (message.type) {
                case 'output':
                    // Write PTY output to terminal
                    terminal.write(message.data);
                    break;
                
                case 'sessionID':
                    // Store session ID received from server
                    sessionID = message.sessionID;
                    updateURLWithSession(sessionID, currentProject);
                    console.log(`Received new session ID: ${sessionID}`);
                    break;
                    
                case 'exit':
                    terminal.write(`\r\nProcess exited with code: ${message.exitCode}\r\n`);
                    terminal.write('Connection closed. Go back to session list.\r\n');
                    isConnected = false;
                    break;
                    
                default:
                    console.log('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    };

    ws.onclose = () => {
        console.log('WebSocket connection closed');
        isConnected = false;
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts);
            reconnectAttempts++;
            console.log(`Attempting to reconnect in ${delay / 1000} seconds... (Attempt ${reconnectAttempts})`);
            terminal.write(`\r\nConnection lost. Attempting to reconnect...\r\n`);
            setTimeout(connectWebSocket, delay);
        } else {
            terminal.write('\r\nConnection lost. Max reconnect attempts reached. Go back to session list.\r\n');
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        terminal.write('\r\nWebSocket error occurred. Attempting to reconnect.\r\n');
        ws.close(); // Force close to trigger onclose and reconnect logic
    };
};

// Function to show project list
async function showProjectList() {
    // Hide navigation bar when showing project list
    hideNavigationBar();
    
    try {
        const response = await fetch('/api/projects');
        const projects = await response.json();
        
        const terminalContainer = document.getElementById('terminal-container');
        terminalContainer.innerHTML = `
            <div class="p-6 max-w-4xl mx-auto">
                <h1 class="text-2xl font-bold mb-6 text-center">Projects</h1>
                <div class="mb-6">
                    <div class="flex gap-2">
                        <input type="text" id="project-name" placeholder="Enter project name" class="input input-bordered flex-1">
                        <button class="btn btn-primary" onclick="createNewProject()">Create Project</button>
                    </div>
                </div>
                <div class="grid gap-4 mb-6">
                    ${projects.length === 0 ? '<p class="text-center opacity-70">No projects found</p>' : 
                        projects.map(project => `
                            <div class="card bg-base-200 shadow-xl">
                                <div class="card-body p-4">
                                    <div class="flex justify-between items-center">
                                        <div class="cursor-pointer flex-1" onclick="selectProject('${project}')">
                                            <h2 class="card-title text-sm">${project}</h2>
                                        </div>
                                        <button class="btn btn-primary btn-sm" onclick="selectProject('${project}')">
                                            Open
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Failed to load projects:', error);
        const terminalContainer = document.getElementById('terminal-container');
        terminalContainer.innerHTML = '<div class="p-6 text-center text-error">Error loading projects</div>';
    }
}

async function createNewProject() {
    const projectNameInput = document.getElementById('project-name');
    const projectName = projectNameInput.value.trim();
    
    if (!projectName) {
        alert('Please enter a project name');
        return;
    }
    
    try {
        const response = await fetch('/api/projects', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: projectName })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            selectProject(result.name);
        } else {
            alert(result.error || 'Failed to create project');
        }
    } catch (error) {
        console.error('Error creating project:', error);
        alert('Error creating project');
    }
}

function selectProject(projectName) {
    currentProject = projectName;
    updateURLWithProject(projectName);
    showProjectSessions(projectName);
}

async function showProjectSessions(projectName) {
    // Hide navigation bar when showing project sessions
    hideNavigationBar();
    
    try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}/sessions`);
        const sessions = await response.json();
        
        const terminalContainer = document.getElementById('terminal-container');
        terminalContainer.innerHTML = `
            <div class="p-6 max-w-4xl mx-auto">
                <div class="mb-6">
                    <button class="btn btn-outline" onclick="goBackToProjectList()">← Back to Projects</button>
                </div>
                <h1 class="text-2xl font-bold mb-6 text-center">Sessions for Project: ${projectName}</h1>
                <div class="grid gap-4 mb-6">
                    ${sessions.length === 0 ? '<p class="text-center opacity-70">No active sessions for this project</p>' : 
                        sessions.map(session => `
                            <div class="card bg-base-200 shadow-xl">
                                <div class="card-body p-4">
                                    <div class="flex justify-between items-start">
                                        <div class="cursor-pointer flex-1" onclick="connectToSession('${session.id}', '${projectName}')">
                                            <h2 class="card-title text-sm">${session.id}</h2>
                                            <p class="text-xs opacity-70 line-clamp-5 break-all">Status: <span>${ansiToHtml(session.status)}</span></p>
                                            <p class="text-xs opacity-50">Created: ${new Date(session.created).toLocaleString()}</p>
                                        </div>
                                        <div class="flex gap-2">
                                            <button class="btn btn-primary btn-sm" onclick="connectToSession('${session.id}', '${projectName}')">
                                                Connect
                                            </button>
                                            <button class="btn btn-error btn-sm" onclick="killSession('${session.id}')">
                                                Kill
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
                <div class="text-center">
                    <button class="btn btn-primary" onclick="createNewSessionForProject('${projectName}')">Create New Session</button>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error fetching sessions:', error);
        const terminalContainer = document.getElementById('terminal-container');
        terminalContainer.innerHTML = '<div class="p-6 text-center text-error">Error loading sessions</div>';
    }
}

// Function to connect to existing session
function connectToSession(sessionId, projectName = null) {
    sessionID = sessionId;
    currentProject = projectName || currentProject;
    updateURLWithSession(sessionID, currentProject);
    initializeTerminal();
}

// Function to kill a session
async function killSession(sessionId) {
    try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        
        if (result.success) {
            // Refresh the appropriate list
            if (currentProject) {
                showProjectSessions(currentProject);
            } else {
                showProjectList();
            }
        } else {
            alert('Failed to kill session: ' + result.message);
        }
    } catch (error) {
        console.error('Error killing session:', error);
        alert('Error killing session');
    }
}

// Function to create new session for project
function createNewSessionForProject(projectName) {
    sessionID = null;
    currentProject = projectName;
    updateURLWithProject(projectName);
    initializeTerminal();
}

// Function to initialize terminal
function initializeTerminal() {
    const terminalContainer = document.getElementById('terminal-container');
    terminalContainer.innerHTML = `
        <div class="flex flex-col h-full">
            <div class="bg-base-200 p-2 border-b border-base-300">
                <button class="btn btn-sm btn-outline" onclick="goBackToSessionList()">
                    ← Back to Sessions
                </button>
            </div>
            <div id="terminal" class="flex-1"></div>
        </div>
    `;
    
    // Create a new terminal instance instead of reusing the old one
    createNewTerminal();
    
    // Mount new terminal to DOM element
    const newTerminalElement = document.getElementById('terminal');
    terminal.open(newTerminalElement);
    fitAddon.fit();
    
    // Set up terminal data handler for the new instance
    terminal.onData((data) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'input',
                data: data
            }));
        }
    });
    
    // Focus the new terminal instance
    terminal.focus();
    
    // Connect WebSocket
    connectWebSocket();
    
    // Show navigation bar when terminal is active
    showNavigationBar();
}

// File browser and editor functions
function showNavigationBar() {
    const navBar = document.getElementById('nav-bar');
    if (navBar) {
        navBar.classList.remove('hidden');
        
        // Update current path display
        const currentPathSpan = document.getElementById('current-path');
        if (currentPathSpan && currentProject) {
            currentPathSpan.textContent = `Project: ${currentProject}`;
        }
    }
}

function hideNavigationBar() {
    const navBar = document.getElementById('nav-bar');
    if (navBar) {
        navBar.classList.add('hidden');
    }
}

async function toggleFileBrowser() {
    const fileBrowser = document.getElementById('file-browser');
    
    if (isFileBrowserOpen) {
        fileBrowser.classList.add('hidden');
        fileBrowser.classList.remove('flex', 'fullscreen');
        isFileBrowserOpen = false;
    } else {
        fileBrowser.classList.remove('hidden');
        fileBrowser.classList.add('flex', 'fullscreen');
        isFileBrowserOpen = true;
        
        // Load initial directory (project directory or home)
        const initialPath = currentProject ? 
            `../projects/${currentProject}` : 
            process.env.HOME || '~';
        await loadDirectory(initialPath);
    }
}

async function loadDirectory(dirPath) {
    try {
        const response = await fetch(`/api/browse?path=${encodeURIComponent(dirPath)}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to load directory');
        }
        
        currentBrowserPath = data.currentPath;
        displayDirectoryContents(data);
        
        // Update current directory input
        const currentDirInput = document.getElementById('current-dir');
        if (currentDirInput) {
            currentDirInput.value = data.currentPath;
        }
    } catch (error) {
        console.error('Error loading directory:', error);
        alert('Failed to load directory: ' + error.message);
    }
}

function displayDirectoryContents(data) {
    const fileList = document.getElementById('file-list');
    if (!fileList) return;
    
    fileList.innerHTML = '';
    
    // Add parent directory link if not at root
    if (data.parentPath && data.parentPath !== data.currentPath) {
        const parentItem = createFileItem({
            name: '..',
            type: 'directory',
            path: data.parentPath
        });
        fileList.appendChild(parentItem);
    }
    
    // Add directory contents
    data.items.forEach(item => {
        const fileItem = createFileItem(item);
        fileList.appendChild(fileItem);
    });
}

function createFileItem(item) {
    const div = document.createElement('div');
    div.className = 'file-item p-2 rounded cursor-pointer flex items-center gap-2 text-sm';
    
    const icon = item.type === 'directory' ? '📁' : '📄';
    const name = item.name.length > 25 ? item.name.substring(0, 22) + '...' : item.name;
    
    div.innerHTML = `
        <span class="text-lg">${icon}</span>
        <span class="flex-1 truncate" title="${item.name}">${name}</span>
    `;
    
    div.addEventListener('click', () => {
        if (item.type === 'directory') {
            loadDirectory(item.path);
        } else {
            openFileInEditor(item.path);
        }
    });
    
    return div;
}

async function openFileInEditor(filePath) {
    try {
        const response = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to load file');
        }
        
        currentEditingFile = data.path;
        
        // Show editor panel in fullscreen
        const fileEditor = document.getElementById('file-editor');
        fileEditor.classList.remove('hidden');
        fileEditor.classList.add('flex', 'fullscreen');
        isFileEditorOpen = true;
        
        // Update editor content
        const fileContent = document.getElementById('file-content');
        const editorFilename = document.getElementById('editor-filename');
        
        if (fileContent) {
            fileContent.value = data.content;
        }
        
        if (editorFilename) {
            const filename = filePath.split('/').pop();
            editorFilename.textContent = filename;
        }
        
    } catch (error) {
        console.error('Error opening file:', error);
        alert('Failed to open file: ' + error.message);
    }
}

async function saveCurrentFile() {
    if (!currentEditingFile) {
        alert('No file is currently being edited');
        return;
    }
    
    try {
        const fileContent = document.getElementById('file-content');
        const content = fileContent ? fileContent.value : '';
        
        const response = await fetch('/api/file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: currentEditingFile,
                content: content
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to save file');
        }
        
        // Show success feedback
        const saveButton = document.getElementById('save-file');
        if (saveButton) {
            const originalText = saveButton.textContent;
            saveButton.textContent = 'Saved!';
            saveButton.classList.add('btn-success');
            setTimeout(() => {
                saveButton.textContent = originalText;
            }, 1000);
        }
        
    } catch (error) {
        console.error('Error saving file:', error);
        alert('Failed to save file: ' + error.message);
    }
}

function closeFileEditor() {
    const fileEditor = document.getElementById('file-editor');
    fileEditor.classList.add('hidden');
    fileEditor.classList.remove('flex', 'fullscreen');
    isFileEditorOpen = false;
    currentEditingFile = null;
}

function closeFileBrowser() {
    const fileBrowser = document.getElementById('file-browser');
    fileBrowser.classList.add('hidden');
    fileBrowser.classList.remove('flex', 'fullscreen');
    isFileBrowserOpen = false;
}

// Create new file function
function createNewFile() {
    const modal = document.getElementById('new-file-modal');
    const input = document.getElementById('new-file-name');
    input.value = '';
    modal.showModal();
    input.focus();
}

// Create new folder function
function createNewFolder() {
    const modal = document.getElementById('new-folder-modal');
    const input = document.getElementById('new-folder-name');
    input.value = '';
    modal.showModal();
    input.focus();
}

// Handle file creation
async function handleFileCreation() {
    const input = document.getElementById('new-file-name');
    const fileName = input.value.trim();
    if (!fileName) return;
    
    if (!currentBrowserPath) {
        alert('No directory selected');
        return;
    }
    
    const filePath = `${currentBrowserPath}/${fileName}`;
    
    try {
        const response = await fetch('/api/file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: filePath,
                content: ''
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to create file');
        }
        
        // Refresh directory listing
        await loadDirectory(currentBrowserPath);
        
        // Open the new file in editor
        await openFileInEditor(filePath);
        
        document.getElementById('new-file-modal').close();
        
    } catch (error) {
        console.error('Error creating file:', error);
        alert('Failed to create file: ' + error.message);
    }
}

// Handle folder creation
async function handleFolderCreation() {
    const input = document.getElementById('new-folder-name');
    const folderName = input.value.trim();
    if (!folderName) return;
    
    if (!currentBrowserPath) {
        alert('No directory selected');
        return;
    }
    
    const folderPath = `${currentBrowserPath}/${folderName}`;
    
    try {
        const response = await fetch('/api/folder', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ path: folderPath })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to create folder');
        }
        
        // Refresh directory listing
        await loadDirectory(currentBrowserPath);
        
        document.getElementById('new-folder-modal').close();
        
    } catch (error) {
        console.error('Error creating folder:', error);
        alert('Failed to create folder: ' + error.message);
    }
}



// Handle browser navigation (back/forward buttons)
window.addEventListener('popstate', (event) => {
    const newSessionID = getSessionIDFromURL();
    const newProject = getProjectFromURL();
    
    sessionID = newSessionID;
    currentProject = newProject;
    
    if (sessionID) {
        initializeTerminal();
    } else if (currentProject) {
        showProjectSessions(currentProject);
    } else {
        showProjectList();
    }
});

// Check URL parameters and show appropriate interface
if (sessionID) {
    initializeTerminal();
} else if (currentProject) {
    showProjectSessions(currentProject);
} else {
    showProjectList();
}

// Event listeners for file browser and editor
document.addEventListener('DOMContentLoaded', () => {
    // Navigation bar event listeners
    const backToSessionsBtn = document.getElementById('back-to-sessions');
    if (backToSessionsBtn) {
        backToSessionsBtn.addEventListener('click', () => {
            if (currentProject) {
                goBackToProjectList();
            } else {
                goBackToSessionList();
            }
        });
    }
    
    const browseFilesBtn = document.getElementById('browse-files');
    if (browseFilesBtn) {
        browseFilesBtn.addEventListener('click', toggleFileBrowser);
    }
    
    // File browser event listeners
    const closeBrowserBtn = document.getElementById('close-browser');
    if (closeBrowserBtn) {
        closeBrowserBtn.addEventListener('click', closeFileBrowser);
    }
    
    const newFolderBtn = document.getElementById('new-folder');
    if (newFolderBtn) {
        newFolderBtn.addEventListener('click', createNewFolder);
    }
    
    const newFileBtn = document.getElementById('new-file');
    if (newFileBtn) {
        newFileBtn.addEventListener('click', createNewFile);
    }
    
    // Modal event listeners
    const createFileBtn = document.getElementById('create-file-btn');
    if (createFileBtn) {
        createFileBtn.addEventListener('click', handleFileCreation);
    }
    
    const cancelFileBtn = document.getElementById('cancel-file-btn');
    if (cancelFileBtn) {
        cancelFileBtn.addEventListener('click', () => {
            document.getElementById('new-file-modal').close();
        });
    }
    
    const createFolderBtn = document.getElementById('create-folder-btn');
    if (createFolderBtn) {
        createFolderBtn.addEventListener('click', handleFolderCreation);
    }
    
    const cancelFolderBtn = document.getElementById('cancel-folder-btn');
    if (cancelFolderBtn) {
        cancelFolderBtn.addEventListener('click', () => {
            document.getElementById('new-folder-modal').close();
        });
    }
    
    // Enter key handling for modal inputs
    const newFileNameInput = document.getElementById('new-file-name');
    if (newFileNameInput) {
        newFileNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleFileCreation();
            }
        });
    }
    
    const newFolderNameInput = document.getElementById('new-folder-name');
    if (newFolderNameInput) {
        newFolderNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleFolderCreation();
            }
        });
    }
    
    // File editor event listeners
    const saveFileBtn = document.getElementById('save-file');
    if (saveFileBtn) {
        saveFileBtn.addEventListener('click', saveCurrentFile);
    }
    
    const closeEditorBtn = document.getElementById('close-editor');
    if (closeEditorBtn) {
        closeEditorBtn.addEventListener('click', closeFileEditor);
    }
    
    // Keyboard shortcuts for editor
    const fileContentTextarea = document.getElementById('file-content');
    if (fileContentTextarea) {
        fileContentTextarea.addEventListener('keydown', (event) => {
            // Ctrl+S or Cmd+S to save
            if ((event.ctrlKey || event.metaKey) && event.key === 's') {
                event.preventDefault();
                saveCurrentFile();
            }
            
            // Tab key handling for proper indentation
            if (event.key === 'Tab') {
                event.preventDefault();
                const start = event.target.selectionStart;
                const end = event.target.selectionEnd;
                const value = event.target.value;
                
                // Insert tab character
                event.target.value = value.substring(0, start) + '\t' + value.substring(end);
                event.target.selectionStart = event.target.selectionEnd = start + 1;
            }
        });
    }
    
    // Global ESC key handler to close fullscreen panels
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            if (isFileEditorOpen) {
                closeFileEditor();
            } else if (isFileBrowserOpen) {
                closeFileBrowser();
            }
        }
    });
    
    // Click outside to close fullscreen panels
    document.addEventListener('click', (event) => {
        const fileBrowser = document.getElementById('file-browser');
        const fileEditor = document.getElementById('file-editor');
        
        if (isFileBrowserOpen && fileBrowser && !fileBrowser.contains(event.target) && !event.target.closest('#browse-files')) {
            closeFileBrowser();
        }
        
        if (isFileEditorOpen && fileEditor && !fileEditor.contains(event.target)) {
            // Don't close if clicking on file items to open them
            if (!event.target.closest('.file-item')) {
                closeFileEditor();
            }
        }
    });
    
    // Prevent clicks inside panels from bubbling up
    const fileBrowser = document.getElementById('file-browser');
    const fileEditor = document.getElementById('file-editor');
    
    if (fileBrowser) {
        fileBrowser.addEventListener('click', (event) => {
            event.stopPropagation();
        });
    }
    
    if (fileEditor) {
        fileEditor.addEventListener('click', (event) => {
            event.stopPropagation();
        });
    }
});

// Terminal input handler is now set up in initializeTerminal() for each new instance

// Handle terminal resize
const handleResize = () => {
    if (fitAddon) {
        fitAddon.fit();
    }
    if (isConnected && terminal) {
        ws.send(JSON.stringify({
            type: 'resize',
            cols: terminal.cols,
            rows: terminal.rows
        }));
    }
};

// Resize terminal when window resizes
window.addEventListener('resize', handleResize);

// Handle visibility change (focus/blur)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && terminal) {
        terminal.focus();
    }
});

// Focus terminal when clicking anywhere
document.addEventListener('click', (event) => {
    // Only focus terminal if the click is not inside the custom input container
    const customInputContainer = document.getElementById('custom-input-container');
    if (customInputContainer && !customInputContainer.contains(event.target) && terminal) {
        terminal.focus();
    }
});

// Custom input field handling
const customCommandInput = document.getElementById('custom-command-input');

if (customCommandInput) {
    const sendCommand = () => {
        // Focus terminal first to ensure it's active
        if (terminal) {
            terminal.focus();
            // Add small delay to ensure focus is properly set
            setTimeout(() => {
                const command = customCommandInput.value; // Add carriage return to simulate Enter
                if (isConnected) {
                    ws.send(JSON.stringify({
                        type: 'input',
                        data: command
                    }));
                    setTimeout(() => {

                        ws.send(JSON.stringify({
                            type: 'input',
                            data: '\r'
                        }));
                    }, 50); // 50ms delay

                    customCommandInput.value = ''; // Clear input after sending
                }
            }, 50); // 50ms delay
        } else {
            // If no terminal, send immediately
            const command = customCommandInput.value + '\r';
            if (isConnected) {
                ws.send(JSON.stringify({
                    type: 'input',
                    data: command
                }));
                customCommandInput.value = '';
            }
        }
    };

    customCommandInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent default Enter behavior
            sendCommand();
        }
    });
}

// Virtual keyboard input
const virtualKeyboard = document.getElementById('virtual-keyboard');
if (virtualKeyboard) {
    virtualKeyboard.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-key-code]');
        if (button) {
            const keyCode = parseInt(button.dataset.keyCode, 10);
            let data = '';

            switch (keyCode) {
                case 27: // Esc
                    data = '\x1B';
                    break;
                case 9: // Tab
                    data = '\x09';
                    break;
                case 17: // Ctrl
                    // Prompt user for the next key
                    const nextKey = prompt("Enter next key for Ctrl combination (e.g., 'c' for Ctrl+C, 'z' for Ctrl+Z):");
                    if (nextKey) {
                        const charCode = nextKey.toLowerCase().charCodeAt(0);
                        if (charCode >= 97 && charCode <= 122) { // 'a' through 'z'
                            data = String.fromCharCode(charCode - 96); // Convert to Ctrl+A to Ctrl+Z
                        } else if (nextKey === '[') {
                            data = '\x1B'; // Ctrl+[ is Esc
                        } else if (nextKey === '\\') {
                            data = '\x1C'; // Ctrl+\ is FS (File Separator)
                        } else if (nextKey === ']') {
                            data = '\x1D'; // Ctrl+] is GS (Group Separator)
                        } else if (nextKey === '^') {
                            data = '\x1E'; // Ctrl+^ is RS (Record Separator)
                        } else if (nextKey === '_') {
                            data = '\x1F'; // Ctrl+_ is US (Unit Separator)
                        }
                    }
                    break;
                case 3: // Ctrl+C (ASCII End-of-Text character)
                    data = '\x03';
                    break;
                case 38: // Up Arrow
                    data = '\x1B[A';
                    break;
                case 40: // Down Arrow
                    data = '\x1B[B';
                    break;
                case 37: // Left Arrow
                    data = '\x1B[D';
                    break;
                case 39: // Right Arrow
                    data = '\x1B[C';
                    break;
                default:
                    // For other keys, if we add them, we'd map them here.
                    break;
            }

            if (isConnected && data) {
                // Focus terminal first to ensure it's active
                if (terminal) {
                    terminal.focus();
                    // Add small delay to ensure focus is properly set
                    setTimeout(() => {
                        ws.send(JSON.stringify({
                            type: 'input',
                            data: data
                        }));
                    }, 50); // 50ms delay
                } else {
                    // If no terminal, send immediately
                    ws.send(JSON.stringify({
                        type: 'input',
                        data: data
                    }));
                }
            }
        }
    });
}