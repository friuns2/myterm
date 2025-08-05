import { ansiToHtml } from './ansi.js';
import { updateURLWithSession, updateURLWithProject, getCurrentProject, setCurrentProject, getSessionID, setSessionID } from './session-manager.js';
import { connectWebSocket, sendTerminalInput } from './websocket.js';
import { createNewTerminal, getTerminalInstance, getFitAddonInstance, handleResize } from './terminal.js';

let currentBrowserPath = null;
let currentEditingFile = null;
let isFileBrowserOpen = false;
let isFileEditorOpen = false;

// Initialize SweetAlert2
const Swal = window.Swal;

export function showNavigationBar() {
    const navBar = document.getElementById('nav-bar');
    if (navBar) {
        navBar.classList.remove('hidden');
        
        // Update current path display
        const currentPathSpan = document.getElementById('current-path');
        const currentProject = getCurrentProject();
        if (currentPathSpan && currentProject) {
            currentPathSpan.textContent = `Project: ${currentProject}`;
        }
    }
}

export function hideNavigationBar() {
    const navBar = document.getElementById('nav-bar');
    if (navBar) {
        navBar.classList.add('hidden');
    }
}

// Function to connect to existing session
export function connectToSession(sessionId, projectName = null) {
    setSessionID(sessionId);
    setCurrentProject(projectName || getCurrentProject());
    updateURLWithSession(getSessionID(), getCurrentProject());
    initializeTerminal();
}

// Function to kill a session
export async function killSession(sessionId) {
    try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        
        if (result.success) {
            // Always go back to the dashboard after killing a session
            showSessionsAndProjectsList();
        } else {
            await Swal.fire({
                title: 'Error',
                text: 'Failed to kill session: ' + result.message,
                icon: 'error'
            });
        }
    } catch (error) {
        console.error('Error killing session:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Error killing session',
            icon: 'error'
        });
    }
}

// Function to create new session for project
export function createNewSessionForProject(projectName) {
    setSessionID(null);
    setCurrentProject(projectName);
    updateURLWithProject(projectName);
    initializeTerminal();
}

// Function to initialize terminal
export function initializeTerminal() {
    const terminalContainer = document.getElementById('terminal-container');
    terminalContainer.innerHTML = `
        <div class="flex flex-col h-full">
            <div id="terminal" class="flex-1"></div>
        </div>
    `;
    
    // Create a new terminal instance instead of reusing the old one
    const terminal = createNewTerminal();
    const fitAddon = getFitAddonInstance();
    
    // Mount new terminal to DOM element
    const newTerminalElement = document.getElementById('terminal');
    terminal.open(newTerminalElement);
    fitAddon.fit();
    
    // Set up terminal data handler for the new instance
    terminal.onData((data) => {
        sendTerminalInput(data);
    });
    
    // Focus the new terminal instance
    terminal.focus();
    
    // Connect WebSocket
    connectWebSocket(getSessionID(), initializeTerminal);
    
    // Show navigation bar when terminal is active
    showNavigationBar();
}

export async function showSessionsAndProjectsList() {
    // Hide navigation bar when showing sessions and projects list
    hideNavigationBar();
    
    try {
        // Fetch all sessions and projects with worktrees in parallel
        const [sessionsResponse, projectsResponse] = await Promise.all([
            fetch('/api/sessions'),
            fetch('/api/projects-with-worktrees')
        ]);
        
        const allSessions = await sessionsResponse.json();
        const projectsWithWorktrees = await projectsResponse.json();
        
        const terminalContainer = document.getElementById('terminal-container');
        terminalContainer.innerHTML = `
            <div class="p-6 max-w-6xl mx-auto h-full flex flex-col overflow-y-auto">
                <h1 class="text-3xl font-bold mb-8 text-center">Shell Dashboard</h1>
                
                <!-- All Sessions Section -->
                <div class="mb-8">
                    <h2 class="text-2xl font-semibold mb-4 flex items-center gap-2">
                        <span class="text-primary">🖥️</span> All Active Sessions
                    </h2>
                    <div class="grid gap-3 mb-6">
                        ${allSessions.length === 0 ? '<p class="text-center opacity-70 py-4">No active sessions</p>' : 
                            allSessions.map(session => `
                                <div class="card bg-base-200 shadow-lg hover:shadow-xl transition-shadow">
                                    <div class="card-body p-4">
                                        <div class="flex justify-between items-start">
                                            <div class="cursor-pointer flex-1" onclick="window.connectToSession('${session.id}', '${session.projectName}')">
                                                <div class="flex items-center gap-2 mb-2">
                                                    <h3 class="font-semibold text-sm">${session.id}</h3>
                                                    <span class="badge badge-primary badge-sm">${session.projectName}</span>
                                                </div>
                                                <p class="text-xs opacity-70 line-clamp-2 break-all">Status: <span>${ansiToHtml(session.status)}</span></p>
                                                <p class="text-xs opacity-50">Created: ${new Date(session.created).toLocaleString()}</p>
                                            </div>
                                            <div class="flex gap-2">
                                                <button class="btn btn-primary btn-sm" onclick="window.connectToSession('${session.id}', '${session.projectName}')">
                                                    Connect
                                                </button>
                                                <button class="btn btn-error btn-sm" onclick="window.killSession('${session.id}')">
                                                    Kill
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
                <!-- All Projects with Worktrees Section -->
                <div class="mb-8">
                    <h2 class="text-2xl font-semibold mb-4 flex items-center gap-2">
                        <span class="text-secondary">📁</span> All Projects & Worktrees
                    </h2>
                    <div class="mb-6">
                        <div class="flex gap-2">
                            <input type="text" id="project-name" placeholder="Enter project name" class="input input-bordered flex-1">
                            <button class="btn btn-primary" onclick="window.createNewProject()">Create Project</button>
                        </div>
                    </div>
                    <div class="grid gap-4">
                        ${projectsWithWorktrees.length === 0 ? '<p class="text-center opacity-70 py-4">No projects found</p>' : 
                            projectsWithWorktrees.map(project => `
                                <div class="card bg-base-300 shadow-lg">
                                    <div class="card-body p-4">
                                        <div class="flex justify-between items-center mb-4">
                                            <div class="cursor-pointer flex-1" onclick="window.selectProject('${project.name}')">
                                                <h3 class="text-lg font-bold">${project.name}</h3>
                                            </div>
                                            <div class="flex gap-2">
                                                <button class="btn btn-primary btn-sm" onclick="window.selectProject('${project.name}')">
                                                    Open Project
                                                </button>
                                                <button class="btn btn-secondary btn-sm" onclick="window.createWorktreeModal('${project.name}')">
                                                    + Worktree
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <!-- Worktrees for this project -->
                                        ${project.worktrees.length > 0 ? `
                                            <div class="mt-3">
                                                <h4 class="text-sm font-semibold mb-2 opacity-80">Worktrees:</h4>
                                                <div class="grid gap-2">
                                                    ${project.worktrees.map(worktree => `
                                                        <div class="bg-base-100 rounded-lg p-3 flex justify-between items-center">
                                                            <div class="cursor-pointer flex-1" onclick="window.openWorktree('${project.name}', '${worktree.name}')">
                                                                <div class="flex items-center gap-2">
                                                                    <span class="text-success">🌿</span>
                                                                    <span class="font-medium text-sm">${worktree.name}</span>
                                                                    <span class="badge badge-outline badge-xs">${worktree.branch}</span>
                                                                </div>
                                                                <p class="text-xs opacity-60 mt-1">${worktree.relativePath}</p>
                                                            </div>
                                                            <div class="flex gap-1">
                                                                <button class="btn btn-xs btn-primary" onclick="window.openWorktree('${project.name}', '${worktree.name}')">
                                                                    Open
                                                                </button>
                                                                <button class="btn btn-xs btn-success" onclick="window.mergeWorktree('${project.name}', '${worktree.name}')">
                                                                    Merge
                                                                </button>
                                                                <button class="btn btn-xs btn-error" onclick="window.deleteWorktree('${project.name}', '${worktree.name}')">
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        </div>
                                                    `).join('')}
                                                </div>
                                            </div>
                                        ` : '<p class="text-xs opacity-50 mt-2">No worktrees</p>'}
                                    </div>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Failed to load sessions and projects:', error);
        const terminalContainer = document.getElementById('terminal-container');
        terminalContainer.innerHTML = '<div class="p-6 text-center text-error">Error loading sessions and projects</div>';
    }
}

export async function showProjectList() {
    // Hide navigation bar when showing project list
    hideNavigationBar();
    
    try {
        const response = await fetch('/api/projects');
        const projects = await response.json();
        
        const terminalContainer = document.getElementById('terminal-container');
        terminalContainer.innerHTML = `
            <div class="p-6 max-w-4xl mx-auto h-full flex flex-col">
                <div class="mb-6">
                    <button class="btn btn-outline" onclick="window.goBackToProjectList()">← Back to Projects</button>
                </div>
                <h1 class="text-2xl font-bold mb-6 text-center">Projects</h1>
                <div class="mb-6">
                    <div class="flex gap-2">
                        <input type="text" id="project-name" placeholder="Enter project name" class="input input-bordered flex-1">
                        <button class="btn btn-primary" onclick="window.createNewProject()">Create Project</button>
                    </div>
                </div>
                <div class="projects-container grid gap-4">
                    ${projects.length === 0 ? '<p class="text-center opacity-70">No projects found</p>' : 
                        projects.map(project => `
                            <div class="card bg-base-200 shadow-xl">
                                <div class="card-body p-4">
                                    <div class="flex justify-between items-center">
                                        <div class="cursor-pointer flex-1" onclick="window.selectProject('${project}')">
                                            <h2 class="card-title text-sm">${project}</h2>
                                        </div>
                                        <div class="flex gap-2">
                                            <button class="btn btn-primary btn-sm" onclick="window.selectProject('${project}')">
                                                Open
                                            </button>
                                            <button class="btn btn-secondary btn-sm" onclick="window.createWorktreeModal('${project}')">
                                                + Worktree
                                            </button>
                                        </div>
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

export async function createNewProject() {
    const projectNameInput = document.getElementById('project-name');
    const projectName = projectNameInput.value.trim();
    
    if (!projectName) {
        await Swal.fire({
            title: 'Error',
            text: 'Please enter a project name',
            icon: 'error'
        });
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
            await Swal.fire({
                title: 'Error',
                text: result.error || 'Failed to create project',
                icon: 'error'
            });
        }
    } catch (error) {
        console.error('Error creating project:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Error creating project',
            icon: 'error'
        });
    }
}

export function selectProject(projectName) {
    setCurrentProject(projectName);
    setSessionID(null);
    updateURLWithProject(projectName);
    initializeTerminal();
}

export async function showProjectSessions(projectName) {
    // Hide navigation bar when showing project sessions
    hideNavigationBar();
    
    try {
        // Fetch both sessions and worktrees in parallel
        const [sessionsResponse, worktreesResponse] = await Promise.all([
            fetch(`/api/projects/${encodeURIComponent(projectName)}/sessions`),
            fetch(`/api/projects/${encodeURIComponent(projectName)}/worktrees`)
        ]);
        
        const sessions = await sessionsResponse.json();
        const worktrees = await worktreesResponse.json();
        
        const terminalContainer = document.getElementById('terminal-container');
        terminalContainer.innerHTML = `
            <div class="p-6 max-w-4xl mx-auto">
                <div class="mb-6">
                    <button class="btn btn-outline" onclick="window.goBackToProjectList()">← Back to Projects</button>
                </div>
                <h1 class="text-2xl font-bold mb-6 text-center">Project: ${projectName}</h1>
                
                <!-- Sessions Section -->
                <div class="mb-8">
                    <h2 class="text-xl font-semibold mb-4">Terminal Sessions</h2>
                    <div class="grid gap-4 mb-6">
                        ${sessions.length === 0 ? '<p class="text-center opacity-70">No active sessions for this project</p>' : 
                            sessions.map(session => `
                                <div class="card bg-base-200 shadow-xl">
                                    <div class="card-body p-4">
                                        <div class="flex justify-between items-start">
                                            <div class="cursor-pointer flex-1" onclick="window.connectToSession('${session.id}', '${projectName}')">
                                                <h2 class="card-title text-sm">${session.id}</h2>
                                                <p class="text-xs opacity-70 line-clamp-5 break-all">Status: <span>${ansiToHtml(session.status)}</span></p>
                                                <p class="text-xs opacity-50">Created: ${new Date(session.created).toLocaleString()}</p>
                                            </div>
                                            <div class="flex gap-2">
                                                <button class="btn btn-primary btn-sm" onclick="window.connectToSession('${session.id}', '${projectName}')">
                                                    Connect
                                                </button>
                                                <button class="btn btn-error btn-sm" onclick="window.killSession('${session.id}')">
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
                        <button class="btn btn-primary" onclick="window.createNewSessionForProject('${projectName}')">Create New Session</button>
                    </div>
                </div>

                <!-- Worktrees Section -->
                <div class="mb-8">
                    <h2 class="text-xl font-semibold mb-4">Git Worktrees</h2>
                    <div class="grid gap-4 mb-6">
                        ${worktrees.length === 0 ? '<p class="text-center opacity-70">No worktrees for this project</p>' : 
                            worktrees.map(worktree => `
                                <div class="card bg-base-300 shadow-xl">
                                    <div class="card-body p-4">
                                        <div class="flex justify-between items-start">
                                            <div class="cursor-pointer flex-1" onclick="window.openWorktree('${projectName}', '${worktree.name}')">
                                                <h2 class="card-title text-sm">🌿 ${worktree.name}</h2>
                                                <p class="text-xs opacity-70">Branch: ${worktree.branch || 'detached'}</p>
                                                <p class="text-xs opacity-50">Path: ${worktree.relativePath}</p>
                                            </div>
                                            <div class="flex gap-2">
                                                <button class="btn btn-primary btn-sm" onclick="window.openWorktree('${projectName}', '${worktree.name}')">
                                                    Open
                                                </button>
                                                <button class="btn btn-success btn-sm" onclick="window.mergeWorktree('${projectName}', '${worktree.name}')">
                                                    Merge
                                                </button>
                                                <button class="btn btn-error btn-sm" onclick="window.deleteWorktree('${projectName}', '${worktree.name}')">
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')
                        }
                    </div>
                    <div class="text-center">
                        <button class="btn btn-secondary" onclick="window.createWorktreeModal('${projectName}')">Create New Worktree</button>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error fetching project data:', error);
        const terminalContainer = document.getElementById('terminal-container');
        terminalContainer.innerHTML = '<div class="p-6 text-center text-error">Error loading project data</div>';
    }
}

export async function toggleFileBrowser() {
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
        const initialPath = getCurrentProject() ? 
            `../projects/${getCurrentProject()}` : 
            process.env.HOME || '~';
        await loadDirectory(initialPath);
    }
}

export async function loadDirectory(dirPath) {
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
        await Swal.fire({
            title: 'Error',
            text: 'Failed to load directory: ' + error.message,
            icon: 'error'
        });
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

export async function openFileInEditor(filePath) {
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
        await Swal.fire({
            title: 'Error',
            text: 'Failed to open file: ' + error.message,
            icon: 'error'
        });
    }
}

export async function saveCurrentFile() {
    if (!currentEditingFile) {
        await Swal.fire({
            title: 'Warning',
            text: 'No file is currently being edited',
            icon: 'warning'
        });
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
        await Swal.fire({
            title: 'Error',
            text: 'Failed to save file: ' + error.message,
            icon: 'error'
        });
    }
}

export function closeFileEditor() {
    const fileEditor = document.getElementById('file-editor');
    fileEditor.classList.add('hidden');
    fileEditor.classList.remove('flex', 'fullscreen');
    isFileEditorOpen = false;
    currentEditingFile = null;
}

export function closeFileBrowser() {
    const fileBrowser = document.getElementById('file-browser');
    fileBrowser.classList.add('hidden');
    fileBrowser.classList.remove('flex', 'fullscreen');
    isFileBrowserOpen = false;
}

// Create new file function
export function createNewFile() {
    const modal = document.getElementById('new-file-modal');
    const input = document.getElementById('new-file-name');
    input.value = '';
    modal.showModal();
    input.focus();
}

// Create new folder function
export function createNewFolder() {
    const modal = document.getElementById('new-folder-modal');
    const input = document.getElementById('new-folder-name');
    input.value = '';
    modal.showModal();
    input.focus();
}

// Handle file creation
export async function handleFileCreation() {
    const input = document.getElementById('new-file-name');
    const fileName = input.value.trim();
    if (!fileName) return;
    
    if (!currentBrowserPath) {
        await Swal.fire({
            title: 'Warning',
            text: 'No directory selected',
            icon: 'warning'
        });
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
        await Swal.fire({
            title: 'Error',
            text: 'Failed to create file: ' + error.message,
            icon: 'error'
        });
    }
}

// Handle folder creation
export async function handleFolderCreation() {
    const input = document.getElementById('new-folder-name');
    const folderName = input.value.trim();
    if (!folderName) return;
    
    if (!currentBrowserPath) {
        await Swal.fire({
            title: 'Warning',
            text: 'No directory selected',
            icon: 'warning'
        });
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
        await Swal.fire({
            title: 'Error',
            text: 'Failed to create folder: ' + error.message,
            icon: 'error'
        });
    }
}

// Worktree management functions
export function createWorktreeModal(projectName) {
    const modal = document.getElementById('new-worktree-modal');
    if (!modal) {
        // Create the modal if it doesn't exist
        const modalHTML = `
            <dialog id="new-worktree-modal" class="modal">
                <div class="modal-box">
                    <h3 class="font-bold text-lg">Create New Worktree</h3>
                    <div class="py-4">
                        <div class="mb-4">
                            <label class="label">
                                <span class="label-text">Worktree Name</span>
                            </label>
                            <input type="text" id="new-worktree-name" placeholder="Enter worktree name..." 
                                   class="input input-bordered w-full" />
                        </div>
                        <div class="mb-4">
                            <label class="label">
                                <span class="label-text">Branch Name (optional)</span>
                            </label>
                            <input type="text" id="new-worktree-branch" placeholder="Enter new branch name..." 
                                   class="input input-bordered w-full" />
                            <div class="label">
                                <span class="label-text-alt">Leave empty to checkout existing branch</span>
                            </div>
                        </div>
                    </div>
                    <div class="modal-action">
                        <button id="create-worktree-btn" class="btn btn-secondary">Create Worktree</button>
                        <button id="cancel-worktree-btn" class="btn">Cancel</button>
                    </div>
                </div>
                <form method="dialog" class="modal-backdrop">
                    <button>close</button>
                </form>
            </dialog>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add event listeners for the new modal
        document.getElementById('create-worktree-btn').addEventListener('click', () => handleWorktreeCreation(projectName));
        document.getElementById('cancel-worktree-btn').addEventListener('click', () => {
            document.getElementById('new-worktree-modal').close();
        });
        
        const worktreeNameInput = document.getElementById('new-worktree-name');
        const worktreeBranchInput = document.getElementById('new-worktree-branch');
        
        worktreeNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleWorktreeCreation(projectName);
            }
        });
        
        worktreeBranchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleWorktreeCreation(projectName);
            }
        });
    }
    
    // Clear inputs and show modal
    document.getElementById('new-worktree-name').value = '';
    document.getElementById('new-worktree-branch').value = '';
    document.getElementById('new-worktree-modal').showModal();
    document.getElementById('new-worktree-name').focus();
}

export async function handleWorktreeCreation(projectName) {
    const nameInput = document.getElementById('new-worktree-name');
    const branchInput = document.getElementById('new-worktree-branch');
    const name = nameInput.value.trim();
    const branch = branchInput.value.trim();
    
    if (!name) {
        await Swal.fire({
            title: 'Error',
            text: 'Please enter a worktree name',
            icon: 'error'
        });
        return;
    }
    
    try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}/worktrees`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, branch: branch || undefined })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            document.getElementById('new-worktree-modal').close();
            // Refresh the project sessions view
            showProjectSessions(projectName);
        } else {
            await Swal.fire({
                title: 'Error',
                text: result.error || 'Failed to create worktree',
                icon: 'error'
            });
        }
    } catch (error) {
        console.error('Error creating worktree:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Error creating worktree',
            icon: 'error'
        });
    }
}

export function openWorktree(projectName, worktreeName) {
    // Open a new terminal session in the worktree directory
    setSessionID(null);
    setCurrentProject(`${projectName}/worktrees/${worktreeName}`);
    updateURLWithProject(getCurrentProject());
    initializeTerminal();
}

export async function mergeWorktree(projectName, worktreeName) {
    const { value: targetBranch } = await Swal.fire({
        title: 'Enter target branch',
        input: 'text',
        inputLabel: 'Target branch to merge into',
        inputValue: 'main',
        showCancelButton: true,
        inputValidator: (value) => {
            if (!value) {
                return 'You need to enter a branch name!';
            }
        }
    });
    
    if (!targetBranch) return; // User cancelled
    
    const confirmResult = await Swal.fire({
        title: 'Confirm merge',
        text: `Are you sure you want to merge worktree "${worktreeName}" into "${targetBranch}"? This will also delete the worktree.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, merge it!'
    });
    
    if (!confirmResult.isConfirmed) return;
    
    try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}/worktrees/${encodeURIComponent(worktreeName)}/merge`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ targetBranch: targetBranch || 'main' })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            await Swal.fire({
                title: 'Success!',
                text: result.message || 'Worktree merged successfully',
                icon: 'success'
            });
            // Refresh the project sessions view
            showProjectSessions(projectName);
        } else {
            await Swal.fire({
                title: 'Error',
                text: result.error || 'Failed to merge worktree',
                icon: 'error'
            });
        }
    } catch (error) {
        console.error('Error merging worktree:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Error merging worktree',
            icon: 'error'
        });
    }
}

export async function deleteWorktree(projectName, worktreeName) {
    const confirmResult = await Swal.fire({
        title: 'Delete Worktree',
        text: `Are you sure you want to delete worktree "${worktreeName}"? This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel'
    });
    
    if (!confirmResult.isConfirmed) return;
    
    try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}/worktrees/${encodeURIComponent(worktreeName)}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            await Swal.fire({
                title: 'Success!',
                text: result.message || 'Worktree deleted successfully',
                icon: 'success'
            });
            // Refresh the project sessions view
            showProjectSessions(projectName);
        } else {
            await Swal.fire({
                title: 'Error',
                text: result.error || 'Failed to delete worktree',
                icon: 'error'
            });
        }
    } catch (error) {
        console.error('Error deleting worktree:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Error deleting worktree',
            icon: 'error'
        });
    }
}

// Initial setup based on URL and event listeners
export function setupUI() {
    // Navigation bar event listeners
    const backToSessionsBtn = document.getElementById('back-to-sessions');
    if (backToSessionsBtn) {
        backToSessionsBtn.addEventListener('click', () => {
            if (getCurrentProject()) {
                goBackToProjectList(showSessionsAndProjectsList);
            } else {
                goBackToSessionList(showProjectSessions, showSessionsAndProjectsList);
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
    
    // Custom input field handling
    const customCommandInput = document.getElementById('custom-command-input');
    if (customCommandInput) {
        const sendCommand = () => {
            // Focus terminal first to ensure it's active
            const terminal = getTerminalInstance();
            if (terminal) {
                terminal.focus();
                // Add small delay to ensure focus is properly set
                setTimeout(() => {
                    const command = customCommandInput.value; // Add carriage return to simulate Enter
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        sendTerminalInput(command);
                        setTimeout(() => {
                            sendTerminalInput('\r');
                        }, 50); // 50ms delay
                        customCommandInput.value = ''; // Clear input after sending
                    }
                }, 50); // 50ms delay
            } else {
                // If no terminal, send immediately
                const command = customCommandInput.value + '\r';
                if (ws && ws.readyState === WebSocket.OPEN) {
                    sendTerminalInput(command);
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
        virtualKeyboard.addEventListener('click', async (event) => {
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
                        const { value: nextKey } = await Swal.fire({
                            title: 'Ctrl Key Combination',
                            input: 'text',
                            inputLabel: 'Enter next key for Ctrl combination',
                            inputPlaceholder: "e.g., 'c' for Ctrl+C, 'z' for Ctrl+Z",
                            showCancelButton: true,
                            inputValidator: (value) => {
                                if (!value) {
                                    return 'You need to enter a key!';
                                }
                            }
                        });
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
                
                if (data) {
                    // Focus terminal first to ensure it's active
                    const terminal = getTerminalInstance();
                    if (terminal) {
                        terminal.focus();
                        // Add small delay to ensure focus is properly set
                        setTimeout(() => {
                            sendTerminalInput(data);
                        }, 50); // 50ms delay
                    } else {
                        // If no terminal, send immediately
                        sendTerminalInput(data);
                    }
                }
            }
        });
    }
    
    // Handle terminal resize
    window.addEventListener('resize', handleResize);
    
    // Handle visibility change (focus/blur)
    document.addEventListener('visibilitychange', () => {
        const terminal = getTerminalInstance();
        if (!document.hidden && terminal) {
            terminal.focus();
        }
    });
    
    // Focus terminal when clicking anywhere
    document.addEventListener('click', (event) => {
        // Only focus terminal if the click is not inside the custom input container
        const customInputContainer = document.getElementById('custom-input-container');
        const terminal = getTerminalInstance();
        if (customInputContainer && !customInputContainer.contains(event.target) && terminal) {
            terminal.focus();
        }
    });
} 