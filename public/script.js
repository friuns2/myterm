// Initialize xterm.js terminal
const { Terminal } = window;
const { FitAddon } = window.FitAddon;

// Global variables for current terminal instance
let terminal = null;
let fitAddon = null;

// File browser and editor state
let currentFilePath = null;
let currentFileContent = '';
let isFileModified = false;
let currentBrowsePath = '';

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
        
        // Show file browser for the project
        setTimeout(() => {
            showFileBrowserForProject();
        }, 100);
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
    
    // Show file browser for the project after connecting
    setTimeout(() => {
        showFileBrowserForProject();
    }, 1000);
}

function showFileBrowserForProject() {
    if (currentProject) {
        currentBrowsePath = '';
        loadFileTree();
        const fileBrowser = document.getElementById('file-browser');
        const toggleBtn = document.getElementById('toggle-files-btn');
        if (fileBrowser && fileBrowser.classList.contains('hidden')) {
            fileBrowser.classList.remove('hidden');
            if (toggleBtn) {
                toggleBtn.classList.add('btn-active');
            }
        }
    }
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

// File Browser and Editor Functionality

// Toggle file browser visibility
function toggleFileBrowser() {
    const fileBrowser = document.getElementById('file-browser');
    const toggleBtn = document.getElementById('toggle-files-btn');
    
    if (fileBrowser.classList.contains('hidden')) {
        fileBrowser.classList.remove('hidden');
        toggleBtn.classList.add('btn-active');
        if (currentProject) {
            loadFileTree();
        }
        // On mobile, scroll to file browser when opened
        if (window.innerWidth <= 768) {
            setTimeout(() => {
                fileBrowser.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    } else {
        fileBrowser.classList.add('hidden');
        toggleBtn.classList.remove('btn-active');
    }
}

// Load file tree for current project
async function loadFileTree(path = '') {
    if (!currentProject) return;
    
    try {
        const response = await fetch(`/api/projects/${encodeURIComponent(currentProject)}/files?path=${encodeURIComponent(path)}`);
        const data = await response.json();
        
        if (data.error) {
            console.error('Error loading files:', data.error);
            return;
        }
        
        const fileTree = document.getElementById('file-tree');
        const projectNameEl = document.getElementById('current-project-name');
        projectNameEl.textContent = currentProject;
        
        if (data.type === 'directory') {
            renderFileTree(data.items, path);
        }
    } catch (error) {
        console.error('Error loading file tree:', error);
    }
}

// Render file tree
function renderFileTree(items, basePath = '') {
    const fileTree = document.getElementById('file-tree');
    
    let html = '';
    
    // Add back button if not at root
    if (basePath) {
        const parentPath = basePath.split('/').slice(0, -1).join('/');
        html += `
            <div class="file-item flex items-center gap-2 p-1 hover:bg-base-300 rounded cursor-pointer" data-path="${parentPath}" data-type="directory">
                <svg class="w-4 h-4 text-base-content/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                </svg>
                <span class="text-sm text-base-content/70">..</span>
            </div>
        `;
    }
    
    // Add files and directories
    items.forEach(item => {
        const icon = item.type === 'directory' 
            ? '<svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5a2 2 0 012-2h2a2 2 0 012 2v0H8v0z"></path></svg>'
            : '<svg class="w-4 h-4 text-base-content/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>';
        
        html += `
            <div class="file-item flex items-center gap-2 p-1 hover:bg-base-300 rounded cursor-pointer" data-path="${item.path}" data-type="${item.type}">
                ${icon}
                <span class="text-sm truncate">${item.name}</span>
            </div>
        `;
    });
    
    fileTree.innerHTML = html;
    currentBrowsePath = basePath;
    
    // Add click handlers
    fileTree.querySelectorAll('.file-item').forEach(item => {
        item.addEventListener('click', () => {
            const path = item.dataset.path;
            const type = item.dataset.type;
            
            if (type === 'directory') {
                loadFileTree(path);
            } else {
                openFile(path);
            }
        });
        
        // Add context menu for delete
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const path = item.dataset.path;
            if (path && path !== '..') {
                if (confirm(`Delete ${item.dataset.type} "${path}"?`)) {
                    deleteFileOrFolder(path);
                }
            }
        });
    });
}

// Open file in editor
async function openFile(filePath) {
    if (!currentProject || !filePath) return;
    
    // Check if current file is modified
    if (isFileModified && !confirm('You have unsaved changes. Continue without saving?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/projects/${encodeURIComponent(currentProject)}/files/content?path=${encodeURIComponent(filePath)}`);
        const data = await response.json();
        
        if (data.error) {
            console.error('Error loading file:', data.error);
            return;
        }
        
        currentFilePath = filePath;
        currentFileContent = data.content;
        isFileModified = false;
        
        // Update UI
        document.getElementById('file-editor').value = data.content;
        document.getElementById('current-file-name').textContent = filePath;
        document.getElementById('current-file-name').classList.remove('hidden');
        document.getElementById('save-file-btn').classList.remove('hidden');
        document.getElementById('editor-tab').classList.remove('hidden');
        
        // Switch to editor tab
        switchToEditor();
        
    } catch (error) {
        console.error('Error opening file:', error);
    }
}

// Save current file
async function saveFile() {
    if (!currentProject || !currentFilePath) return;
    
    const content = document.getElementById('file-editor').value;
    
    try {
        const response = await fetch(`/api/projects/${encodeURIComponent(currentProject)}/files/content`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: currentFilePath,
                content: content
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            console.error('Error saving file:', data.error);
            alert('Error saving file: ' + data.error);
            return;
        }
        
        currentFileContent = content;
        isFileModified = false;
        updateSaveButtonState();
        
        // Show success feedback
        const saveBtn = document.getElementById('save-file-btn');
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Saved';
        setTimeout(() => {
            saveBtn.innerHTML = originalText;
        }, 1000);
        
    } catch (error) {
        console.error('Error saving file:', error);
        alert('Error saving file');
    }
}

// Create new file
async function createNewFile(fileName) {
    if (!currentProject || !fileName) return;
    
    const filePath = currentBrowsePath ? `${currentBrowsePath}/${fileName}` : fileName;
    
    try {
        const response = await fetch(`/api/projects/${encodeURIComponent(currentProject)}/files`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: filePath,
                type: 'file'
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            alert('Error creating file: ' + data.error);
            return;
        }
        
        // Refresh file tree and open the new file
        loadFileTree(currentBrowsePath);
        openFile(filePath);
        
    } catch (error) {
        console.error('Error creating file:', error);
        alert('Error creating file');
    }
}

// Create new folder
async function createNewFolder(folderName) {
    if (!currentProject || !folderName) return;
    
    const folderPath = currentBrowsePath ? `${currentBrowsePath}/${folderName}` : folderName;
    
    try {
        const response = await fetch(`/api/projects/${encodeURIComponent(currentProject)}/files`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: folderPath,
                type: 'directory'
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            alert('Error creating folder: ' + data.error);
            return;
        }
        
        // Refresh file tree
        loadFileTree(currentBrowsePath);
        
    } catch (error) {
        console.error('Error creating folder:', error);
        alert('Error creating folder');
    }
}

// Delete file or folder
async function deleteFileOrFolder(path) {
    if (!currentProject || !path) return;
    
    try {
        const response = await fetch(`/api/projects/${encodeURIComponent(currentProject)}/files`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: path
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            alert('Error deleting: ' + data.error);
            return;
        }
        
        // If deleted file is currently open, close it
        if (currentFilePath === path) {
            closeFile();
        }
        
        // Refresh file tree
        loadFileTree(currentBrowsePath);
        
    } catch (error) {
        console.error('Error deleting:', error);
        alert('Error deleting');
    }
}

// Close current file
function closeFile() {
    currentFilePath = null;
    currentFileContent = '';
    isFileModified = false;
    
    document.getElementById('file-editor').value = '';
    document.getElementById('current-file-name').classList.add('hidden');
    document.getElementById('save-file-btn').classList.add('hidden');
    document.getElementById('editor-tab').classList.add('hidden');
    
    switchToTerminal();
}

// Switch between terminal and editor
function switchToTerminal() {
    document.getElementById('terminal-container').classList.remove('hidden');
    document.getElementById('editor-container').classList.add('hidden');
    document.getElementById('terminal-tab').classList.add('btn-active');
    document.getElementById('terminal-tab').classList.remove('btn-ghost');
    document.getElementById('editor-tab').classList.remove('btn-active');
    document.getElementById('editor-tab').classList.add('btn-ghost');
    
    // Resize terminal
    if (terminal && fitAddon) {
        setTimeout(() => {
            fitAddon.fit();
        }, 100);
    }
}

function switchToEditor() {
    document.getElementById('terminal-container').classList.add('hidden');
    document.getElementById('editor-container').classList.remove('hidden');
    document.getElementById('editor-tab').classList.add('btn-active');
    document.getElementById('editor-tab').classList.remove('btn-ghost');
    document.getElementById('terminal-tab').classList.remove('btn-active');
    document.getElementById('terminal-tab').classList.add('btn-ghost');
    
    // Focus editor
    document.getElementById('file-editor').focus();
}

// Update save button state
function updateSaveButtonState() {
    const saveBtn = document.getElementById('save-file-btn');
    if (isFileModified) {
        saveBtn.classList.remove('btn-ghost');
        saveBtn.classList.add('btn-primary');
    } else {
        saveBtn.classList.add('btn-ghost');
        saveBtn.classList.remove('btn-primary');
    }
}

// Event Listeners

// Toggle files button
document.getElementById('toggle-files-btn').addEventListener('click', toggleFileBrowser);

// Tab switching
document.getElementById('terminal-tab').addEventListener('click', switchToTerminal);
document.getElementById('editor-tab').addEventListener('click', switchToEditor);

// Save file button
document.getElementById('save-file-btn').addEventListener('click', saveFile);

// File editor change detection
document.getElementById('file-editor').addEventListener('input', () => {
    const currentContent = document.getElementById('file-editor').value;
    isFileModified = currentContent !== currentFileContent;
    updateSaveButtonState();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+S to save
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (currentFilePath) {
            saveFile();
        }
    }
    
    // Ctrl+` to toggle terminal/editor
    if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        const terminalVisible = !document.getElementById('terminal-container').classList.contains('hidden');
        if (terminalVisible && currentFilePath) {
            switchToEditor();
        } else {
            switchToTerminal();
        }
    }
});

// Mobile touch handling
let touchStartY = 0;
let touchStartX = 0;

document.addEventListener('touchstart', function(e) {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
}, { passive: true });

document.addEventListener('touchend', function(e) {
    if (!touchStartY || !touchStartX) return;
    
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndX = e.changedTouches[0].clientX;
    const diffY = touchStartY - touchEndY;
    const diffX = touchStartX - touchEndX;
    
    // Only handle swipes on mobile
    if (window.innerWidth <= 768) {
        // Horizontal swipe to toggle file browser (only if vertical swipe is minimal)
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50 && Math.abs(diffY) < 100) {
            const fileBrowser = document.getElementById('file-browser');
            if (diffX > 0 && !fileBrowser.classList.contains('hidden')) {
                // Swipe left to hide file browser
                toggleFileBrowser();
            } else if (diffX < 0 && fileBrowser.classList.contains('hidden')) {
                // Swipe right to show file browser
                toggleFileBrowser();
            }
        }
    }
    
    touchStartY = 0;
    touchStartX = 0;
}, { passive: true });

// Handle orientation changes
window.addEventListener('orientationchange', function() {
    setTimeout(() => {
        // Recalculate terminal size
        if (terminal && fitAddon) {
            fitAddon.fit();
        }
        
        // Adjust layout
        const fileBrowser = document.getElementById('file-browser');
        const contentArea = document.getElementById('content-area');
        
        if (window.innerWidth <= 768) {
            // Portrait mode - stack vertically
            if (fileBrowser && contentArea) {
                fileBrowser.style.height = '40vh';
                contentArea.style.height = '60vh';
            }
        } else {
            // Landscape mode - side by side
            if (fileBrowser && contentArea) {
                fileBrowser.style.height = 'auto';
                contentArea.style.height = 'auto';
            }
        }
    }, 100);
});

// New file/folder buttons
document.getElementById('new-file-btn').addEventListener('click', () => {
    document.getElementById('new-file-modal').classList.add('modal-open');
    document.getElementById('new-file-name').focus();
});

document.getElementById('new-folder-btn').addEventListener('click', () => {
    document.getElementById('new-folder-modal').classList.add('modal-open');
    document.getElementById('new-folder-name').focus();
});

document.getElementById('refresh-files-btn').addEventListener('click', () => {
    loadFileTree(currentBrowsePath);
});

// Modal handlers
document.getElementById('create-file-btn').addEventListener('click', () => {
    const fileName = document.getElementById('new-file-name').value.trim();
    if (fileName) {
        createNewFile(fileName);
        document.getElementById('new-file-modal').classList.remove('modal-open');
        document.getElementById('new-file-name').value = '';
    }
});

document.getElementById('create-folder-btn').addEventListener('click', () => {
    const folderName = document.getElementById('new-folder-name').value.trim();
    if (folderName) {
        createNewFolder(folderName);
        document.getElementById('new-folder-modal').classList.remove('modal-open');
        document.getElementById('new-folder-name').value = '';
    }
});

// Enter key in modals
document.getElementById('new-file-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('create-file-btn').click();
    }
});

document.getElementById('new-folder-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('create-folder-btn').click();
    }
});

// Show file browser when a project is selected
function showFileBrowserForProject() {
    if (currentProject) {
        const fileBrowser = document.getElementById('file-browser');
        if (fileBrowser.classList.contains('hidden')) {
            toggleFileBrowser();
        } else {
            loadFileTree();
        }
    }
}