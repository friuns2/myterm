// Project and session management functionality

// Function to navigate back to session list
let sessionsStatusIntervalId = null;

// Cache for no-flicker dashboard rendering
let dashboardCacheHTML = '';
let dashboardScrollTop = 0;

function getDashboardScroller() {
    return document.getElementById('dashboard-scroll');
}

function saveDashboardSnapshot() {
    try {
        const terminalContainer = document.getElementById('terminal-container');
        if (terminalContainer) {
            dashboardCacheHTML = terminalContainer.innerHTML;
        }
    } catch (_) {}
}

function saveDashboardScroll() {
    try {
        const scroller = getDashboardScroller();
        if (scroller) dashboardScrollTop = scroller.scrollTop;
    } catch (_) {}
}

function restoreDashboardScroll() {
    try {
        const scroller = getDashboardScroller();
        if (!scroller) return;
        // Restore after layout
        requestAnimationFrame(() => {
            try { scroller.scrollTop = dashboardScrollTop || 0; } catch (_) {}
        });
    } catch (_) {}
}

function stopSessionsStatusAutoRefresh() {
    if (sessionsStatusIntervalId) {
        clearInterval(sessionsStatusIntervalId);
        sessionsStatusIntervalId = null;
    }
}

function startSessionsStatusAutoRefresh() {
    stopSessionsStatusAutoRefresh();
    sessionsStatusIntervalId = setInterval(async () => {
        try {
            const res = await fetch('/api/sessions');
            if (!res.ok) return;
            const sessions = await res.json();
            sessions.forEach(session => {
                const el = document.getElementById(`session-thumb-${session.id}`);
                if (el) el.innerHTML = ansiToHtml(session.thumbnail || '');
                const commitEl = document.getElementById(`session-commit-${session.id}`);
                if (commitEl) {
                    const subject = session.lastCommitSubject || '';
                    const hash = session.lastCommitShortHash || '';
                    commitEl.textContent = subject && hash ? `${hash} — ${subject}` : '';
                }
            });
        } catch (e) {
            // ignore transient errors
        }
    }, 2000);
}
function goBackToSessionList() {
    // Cleanup terminal before navigating away
    if (typeof cleanupTerminal === 'function') {
        cleanupTerminal();
    }
    
    sessionID = null;
    currentProject = null;
    clearURLParams();
    showSessionsAndProjectsList();
}

function goBackToProjectList() {
    // Cleanup terminal before navigating away
    if (typeof cleanupTerminal === 'function') {
        cleanupTerminal();
    }
    
    sessionID = null;
    currentProject = null;
    clearURLParams();
    showSessionsAndProjectsList();
}

// Function to show project list
async function showSessionsAndProjectsList() {
    // Hide navigation bar when showing sessions and projects list
    hideNavigationBar();
    // If we have a cached dashboard, render it immediately to avoid flicker
    try {
        if (dashboardCacheHTML) {
            const terminalContainer = document.getElementById('terminal-container');
            if (terminalContainer) {
                terminalContainer.innerHTML = dashboardCacheHTML;
                restoreDashboardScroll();
            }
        }
    } catch (_) {}

    try {
        // Fetch sessions, projects, ports and available shell functions in parallel
        const [sessionsResponse, projectsResponse, portsResponse, functionsResponse] = await Promise.all([
            fetch('/api/sessions'),
            fetch('/api/projects-with-worktrees'),
            fetch('/api/sessions/ports'),
            fetch('/api/settings/functions')
        ]);
        
        const allSessions = await sessionsResponse.json();
        const projectsWithWorktrees = await projectsResponse.json();
        let allPorts = [];
        try {
            const p = await portsResponse.json();
            allPorts = (p && p.ports) || [];
        } catch (_) {}
        let functionsList = [];
        try {
            const f = await functionsResponse.json();
            functionsList = (f && f.functions) || [];
        } catch (_) {}
        
        const terminalContainer = document.getElementById('terminal-container');
        terminalContainer.innerHTML = `
            <div id="dashboard-scroll" class="p-6 max-w-6xl mx-auto h-full flex flex-col overflow-y-auto">
                <div class="flex items-center justify-between mb-8">
                    <h1 class="text-3xl font-bold">Shell Dashboard</h1>
                    <div class="flex gap-2">
                        <button class="btn btn-outline btn-sm" onclick="showSettingsManager()">
                            <span class="text-lg">⚡</span> Shell Settings
                        </button>
                    </div>
                </div>
                
                <!-- Development Ports Section -->
                ${allPorts.length > 0 ? `
                <div class="mb-8">
                    <h2 class="text-2xl font-semibold mb-4 flex items-center gap-2">
                        <span class="text-accent">🚀</span> Development Ports
                    </h2>
                    <div class="flex flex-wrap gap-2 mb-6">
                        ${allPorts.map(port => `
                            <div class="flex gap-1">
                                <button class="btn btn-sm btn-outline btn-success" onclick="createPinggyTunnel(${port})" title="Create pinggy.io tunnel for port ${port}">
                                    🚀 ${port}
                                </button>
                                <button class="btn btn-sm btn-outline btn-error" onclick="killProcessByPort('', ${port})" title="Kill process on port ${port}">
                                    ❌
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
                
                <!-- All Sessions Section -->
                <div class="mb-8">
                    <h2 class="text-2xl font-semibold mb-4 flex items-center gap-2">
                        <span class="text-primary">🖥️</span> All Active Sessions
                    </h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
                        ${allSessions.length === 0 ? '<p class="text-center opacity-70 py-4">No active sessions</p>' : 
                            allSessions.map(session => `
                                <div class="card bg-base-200 shadow-lg hover:shadow-xl transition-shadow h-fit">
                                    <div class="card-body p-3">
                                        <div class="cursor-pointer" onclick="connectToSession('${session.id}', '${session.projectName}', '${session.path || ''}')">
                                            <div class="flex items-center gap-2 mb-2">
                                                <h3 class="font-semibold text-xs truncate flex-1">${session.id}</h3>
                                                <span class="badge badge-primary badge-xs">${session.projectName}</span>
                                            </div>
                                            ${session.title ? `<div class="text-[10px] opacity-80 mb-1 truncate" title="${escapeHtml(session.title)}">📝 ${escapeHtml(session.title)}</div>` : ''}
                                            <div class="session-thumb mb-2">
                                                <pre id="session-thumb-${session.id}" class="text-[6px] leading-tight">${ansiToHtml(escapeHtml(session.thumbnail || ''))}</pre>
                                            </div>
                                            <p class="text-[10px] opacity-70 mb-1 truncate" id="session-commit-${session.id}">${(session.lastCommitShortHash && session.lastCommitSubject) ? `${session.lastCommitShortHash} — ${session.lastCommitSubject}` : ''}</p>
                                            <p class="text-[10px] opacity-50 truncate">Created: ${new Date(session.created).toLocaleString('en-US', { 
                                                year: 'numeric', 
                                                month: '2-digit', 
                                                day: '2-digit', 
                                                hour: '2-digit', 
                                                minute: '2-digit', 
                                                second: '2-digit',
                                                hour12: true
                                            })}</p>
                                        </div>
                                        <div class="flex gap-1 mt-3">
                                            <button class="btn btn-primary btn-xs flex-1" onclick="connectToSession('${session.id}', '${session.projectName}', '${session.path || ''}')">
                                                Connect
                                            </button>
                                            <button class="btn btn-error btn-xs" onclick="killSession('${session.id}')">
                                                ❌
                                            </button>
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
                            <input type="text" id="project-name" placeholder="Enter project name (or leave empty for random name)" class="input input-bordered flex-1">
                            <button class="btn btn-primary" onclick="createNewProject()">Create Project</button>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        ${projectsWithWorktrees.length === 0 ? '<p class="text-center opacity-70 py-4">No projects found</p>' : 
                            projectsWithWorktrees.map(project => `
                                <div class="card bg-base-300 shadow-lg h-fit">
                                    <div class="card-body p-3">
                                        <div class="flex justify-between items-center mb-3">
                                            <div class="cursor-pointer flex-1" onclick="selectProject('${project.name}')">
                                                <h3 class="text-base font-bold truncate">${project.name}</h3>
                                            </div>
                                        </div>
                                        <div class="flex flex-wrap gap-1 mb-3">
                                            <button class="btn btn-primary btn-xs" onclick="selectProject('${project.name}')">
                                                📂 Open
                                            </button>
                                            <button class="btn btn-secondary btn-xs" onclick="createWorktreeModal('${project.name}')">
                                                🌿 Worktree
                                            </button>
                                            <button class="btn btn-error btn-xs" onclick="deleteProject('${project.name}')">
                                                🗑️ Delete
                                            </button>
                                        </div>

                                        ${functionsList.length > 0 ? `
                                            <div class="mb-2">
                                                <h4 class="text-xs font-semibold mb-1 opacity-80">Actions:</h4>
                                                <div class="flex flex-wrap gap-1">
                                                    ${functionsList.map(fn => `
                                                        <button class="btn btn-xs btn-accent" onclick="runFunctionFromButton('${project.name}','${fn.name}',${fn.numParams || 0})">${fn.name}</button>
                                                    `).join('')}
                                                </div>
                                            </div>
                                        ` : ''}
                                        
                                        <!-- Worktrees for this project -->
                                        ${project.worktrees.length > 0 ? `
                                            <div>
                                                <h4 class="text-xs font-semibold mb-1 opacity-80">Worktrees:</h4>
                                                <div class="space-y-1">
                                                    ${project.worktrees.map(worktree => `
                                                        <div class="bg-base-100 rounded p-2">
                                                            <div class="cursor-pointer mb-1" onclick="openWorktree('${project.name}', '${worktree.name}')">
                                                                <div class="flex items-center gap-1">
                                                                    <span class="text-success text-xs">🌿</span>
                                                                    <span class="font-medium text-xs truncate flex-1">${worktree.name}</span>
                                                                    <span class="badge badge-outline badge-xs">${worktree.branch}</span>
                                                                </div>
                                                                <p class="text-[10px] opacity-60 truncate">${worktree.relativePath}</p>
                                                            </div>
                                                            <div class="flex gap-1">
                                                                <button class="btn btn-xs btn-primary" onclick="openWorktree('${project.name}', '${worktree.name}')">
                                                                    📂
                                                                </button>
                                                                <button class="btn btn-xs btn-success" onclick="mergeWorktree('${project.name}', '${worktree.name}')">
                                                                    🔀
                                                                </button>
                                                                <button class="btn btn-xs btn-error" onclick="deleteWorktree('${project.name}', '${worktree.name}')">
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        </div>
                                                    `).join('')}
                                                </div>
                                            </div>
                                        ` : '<p class="text-xs opacity-50">No worktrees</p>'}
                                    </div>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
            </div>
        `;
        // Update cache and restore scroll
        dashboardCacheHTML = terminalContainer.innerHTML;
        restoreDashboardScroll();
        startSessionsStatusAutoRefresh();
    } catch (error) {
        console.error('Failed to load sessions and projects:', error);
        const terminalContainer = document.getElementById('terminal-container');
        terminalContainer.innerHTML = '<div class="p-6 text-center text-error">Error loading sessions and projects</div>';
    }
}

// Run a specific function chosen by clicking a button in the project card
async function runFunctionFromButton(projectName, fnName, numParams) {
    try {
        const args = [];
        for (let i = 1; i <= (numParams || 0); i++) {
            const { value: argVal, isDismissed } = await Swal.fire({
                title: `${fnName}: Param ${i}`,
                input: 'text',
                inputPlaceholder: `Enter $${i}`,
                showCancelButton: true
            });
            if (isDismissed) return;
            args.push(argVal ?? '');
        }
        await runFunctionInProjectTerminal(projectName, fnName, args);
    } catch (e) {
        console.error('Run function error:', e);
        await Swal.fire({ title: 'Error', text: String(e.message || e), icon: 'error' });
    }
}

function shellQuote(arg) {
    const s = String(arg ?? '');
    return "'" + s.replace(/'/g, "'\"'\"'") + "'";
}

async function waitForTerminalConnection(timeoutMs = 8000) {
    const start = Date.now();
    while (!(typeof isConnected !== 'undefined' && isConnected)) {
        if (Date.now() - start > timeoutMs) throw new Error('Terminal connection timeout');
        await new Promise(r => setTimeout(r, 100));
    }
}

async function runFunctionInProjectTerminal(projectName, fnName, args) {
    // If not already in this project or terminal not active, create session
    if (typeof currentProject === 'undefined' || currentProject !== projectName || typeof ws === 'undefined') {
        createNewSessionForProject(projectName);
    }
    await waitForTerminalConnection();
    const cmd = `${fnName} ${args.map(a => shellQuote(a)).join(' ')}`.trim();
    // Focus and send via websocket
    try {
        if (terminal) terminal.focus();
    } catch (_) {}
    // Send command and newline similar to custom input behavior
    ws.send(JSON.stringify({ type: 'input', data: cmd }));
    setTimeout(() => {
        try { ws.send(JSON.stringify({ type: 'input', data: '\\r' })); } catch (_) {}
    }, 50);
}

// Function to generate a random project name
function generateRandomProjectName() {
    const adjectives = ['awesome', 'brilliant', 'creative', 'dynamic', 'elegant', 'fantastic', 'gorgeous', 'incredible', 'magnificent', 'outstanding', 'perfect', 'remarkable', 'spectacular', 'wonderful', 'amazing', 'beautiful', 'charming', 'delightful', 'excellent', 'fabulous'];
    const nouns = ['project', 'app', 'tool', 'system', 'platform', 'framework', 'solution', 'engine', 'builder', 'creator', 'manager', 'helper', 'studio', 'workspace', 'lab', 'forge', 'craft', 'maker', 'hub', 'center'];
    
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNumber = Math.floor(Math.random() * 1000);
    
    return `${randomAdjective}-${randomNoun}-${randomNumber}`;
}

async function createNewProject() {
    const projectNameInput = document.getElementById('project-name');
    let projectName = projectNameInput.value.trim();
    
    // If no name is provided, generate a random one
    if (!projectName) {
        projectName = generateRandomProjectName();
        projectNameInput.value = projectName;
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

async function deleteProject(projectName) {
    const result = await Swal.fire({
        title: 'Delete Project?',
        text: `Are you sure you want to delete the project "${projectName}"? This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}`, {
                method: 'DELETE'
            });
            
            const deleteResult = await response.json();
            
            if (response.ok) {
                await Swal.fire({
                    title: 'Deleted!',
                    text: deleteResult.message || 'Project deleted successfully',
                    icon: 'success'
                });
                // Refresh the projects list
                showSessionsAndProjectsList();
            } else {
                await Swal.fire({
                    title: 'Error',
                    text: deleteResult.error || 'Failed to delete project',
                    icon: 'error'
                });
            }
        } catch (error) {
            console.error('Error deleting project:', error);
            await Swal.fire({
                title: 'Error',
                text: 'Error deleting project',
                icon: 'error'
            });
        }
    }
}

function selectProject(projectName) {
    saveDashboardScroll();
    saveDashboardSnapshot();
    currentProject = projectName;
    sessionID = null;
    stopSessionsStatusAutoRefresh();
    initializeTerminal();
}



// Function to connect to existing session
function connectToSession(sessionId, projectName = null, sessionPath = '') {
    // Cleanup existing terminal before connecting to new session
    saveDashboardScroll();
    saveDashboardSnapshot();
    if (typeof cleanupTerminal === 'function') {
        cleanupTerminal();
    }
    
    sessionID = sessionId;
    currentProject = projectName || currentProject;
    if (sessionPath && typeof sessionPath === 'string' && sessionPath.startsWith('/')) {
        window.__lastSessionPath = sessionPath;
    }
    updateURLWithSession(sessionID, currentProject);
    stopSessionsStatusAutoRefresh();
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
            // Always go back to the dashboard after killing a session
            saveDashboardScroll();
            saveDashboardSnapshot();
            clearURLParams();
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
function createNewSessionForProject(projectName) {
    // Cleanup existing terminal before creating new session
    if (typeof cleanupTerminal === 'function') {
        cleanupTerminal();
    }
    
    sessionID = null;
    currentProject = projectName;
    stopSessionsStatusAutoRefresh();
    initializeTerminal();
}

// Function to create pinggy.io tunnel
async function createPinggyTunnel(port) {
    try {
        // Show loading message
        const loadingAlert = Swal.fire({
            title: 'Creating Tunnel',
            text: `Creating pinggy.io tunnel for port ${port}...`,
            icon: 'info',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        // Create pinggy tunnel in background
        const response = await fetch('/api/sessions/create-tunnel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ port })
        });

        const result = await response.json();
        loadingAlert.close();

        if (result.success) {
            // Show success message with tunnel URL
            await Swal.fire({
                title: 'Tunnel Created!',
                html: `Tunnel created successfully!<br><br><strong>URL:</strong> <a href="${result.url}" target="_blank">${result.url}</a>`,
                icon: 'success',
                confirmButtonText: 'Open Tunnel',
                showCancelButton: true,
                cancelButtonText: 'Close'
            }).then((result) => {
                if (result.isConfirmed) {
                    window.open(result.url, '_blank');
                }
            });
        } else {
            await Swal.fire({
                title: 'Error',
                text: `Failed to create tunnel: ${result.message}`,
                icon: 'error'
            });
        }
    } catch (error) {
        console.error('Error creating tunnel:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Failed to create tunnel. Please try again.',
            icon: 'error'
        });
    }
}

// Function to kill process by port
async function killProcessByPort(sessionId, port) {
    const confirmResult = await Swal.fire({
        title: 'Kill Process',
        text: `Are you sure you want to kill the process running on port ${port}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, kill it!',
        cancelButtonText: 'Cancel'
    });
    
    if (!confirmResult.isConfirmed) return;
    
    try {
        const response = await fetch(`/api/sessions/ports/${port}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            await Swal.fire({
                title: 'Success!',
                text: result.message,
                icon: 'success'
            });
            // Refresh the sessions list to update port status
            showSessionsAndProjectsList();
        } else {
            await Swal.fire({
                title: 'Error',
                text: `Failed to kill process: ${result.message}`,
                icon: 'error'
            });
        }
    } catch (error) {
        console.error('Error killing process:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Failed to kill process. Please try again.',
            icon: 'error'
        });
    }
}