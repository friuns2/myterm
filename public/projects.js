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
        // Fetch sessions, projects and available shell functions in parallel
        const [sessionsResponse, projectsResponse, functionsResponse] = await Promise.all([
            fetch('/api/sessions'),
            fetch('/api/projects-with-worktrees'),
            fetch('/api/settings/functions')
        ]);
        
        const allSessions = await sessionsResponse.json();
        const projectsWithWorktrees = await projectsResponse.json();
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
                                            <div class="cursor-pointer flex-1" onclick="connectToSession('${session.id}', '${session.projectName}', '${session.path || ''}')">
                                                <div class="flex items-center gap-2 mb-2">
                                                    <h3 class="font-semibold text-sm">${session.id}</h3>
                                                    <span class="badge badge-primary badge-sm">${session.projectName}</span>
                                                </div>
                                                <div class="session-thumb">
                                                    <pre id="session-thumb-${session.id}">${ansiToHtml(session.thumbnail || '')}</pre>
                                                </div>
                                                <p class="text-xs opacity-70 mt-2" id="session-commit-${session.id}">${(session.lastCommitShortHash && session.lastCommitSubject) ? `${session.lastCommitShortHash} — ${session.lastCommitSubject}` : ''}</p>
                                                <p class="text-xs opacity-50">Created: ${new Date(session.created).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div class="flex gap-2 mt-4 justify-end">
                                            <button class="btn btn-primary btn-sm" onclick="connectToSession('${session.id}', '${session.projectName}', '${session.path || ''}')">
                                                Connect
                                            </button>
                                            <button class="btn btn-error btn-sm" onclick="killSession('${session.id}')">
                                                Kill
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
                            <input type="text" id="project-name" placeholder="Enter project name" class="input input-bordered flex-1">
                            <button class="btn btn-primary" onclick="createNewProject()">Create Project</button>
                        </div>
                    </div>
                    <div class="grid gap-4">
                        ${projectsWithWorktrees.length === 0 ? '<p class="text-center opacity-70 py-4">No projects found</p>' : 
                            projectsWithWorktrees.map(project => `
                                <div class="card bg-base-300 shadow-lg">
                                    <div class="card-body p-4">
                                        <div class="flex justify-between items-center mb-4">
                                            <div class="cursor-pointer flex-1" onclick="selectProject('${project.name}')">
                                                <h3 class="text-lg font-bold">${project.name}</h3>
                                            </div>
                                            <div class="flex gap-2">
                                                <button class="btn btn-primary btn-sm" onclick="selectProject('${project.name}')">
                                                    Open Project
                                                </button>
                                                <button class="btn btn-secondary btn-sm" onclick="createWorktreeModal('${project.name}')">
                                                    + Worktree
                                                </button>
                                                <button class="btn btn-error btn-sm" onclick="deleteProject('${project.name}')">
                                                    Delete
                                                </button>
                                            </div>
                                        </div>

                                        ${functionsList.length > 0 ? `
                                            <div class="mt-2">
                                                <h4 class="text-sm font-semibold mb-2 opacity-80">Actions:</h4>
                                                <div class="flex flex-wrap gap-1">
                                                    ${functionsList.map(fn => `
                                                        <button class=\"btn btn-xs btn-accent\" onclick=\"runFunctionFromButton('${project.name}','${fn.name}',${fn.numParams || 0})\">${fn.name}</button>
                                                    `).join('')}
                                                </div>
                                            </div>
                                        ` : ''}
                                        
                                        <!-- Worktrees for this project -->
                                        ${project.worktrees.length > 0 ? `
                                            <div class="mt-3">
                                                <h4 class="text-sm font-semibold mb-2 opacity-80">Worktrees:</h4>
                                                <div class="grid gap-2">
                                                    ${project.worktrees.map(worktree => `
                                                        <div class="bg-base-100 rounded-lg p-3 flex justify-between items-center">
                                                            <div class="cursor-pointer flex-1" onclick="openWorktree('${project.name}', '${worktree.name}')">
                                                                <div class="flex items-center gap-2">
                                                                    <span class="text-success">🌿</span>
                                                                    <span class="font-medium text-sm">${worktree.name}</span>
                                                                    <span class="badge badge-outline badge-xs">${worktree.branch}</span>
                                                                </div>
                                                                <p class="text-xs opacity-60 mt-1">${worktree.relativePath}</p>
                                                            </div>
                                                            <div class="flex gap-1">
                                                                <button class="btn btn-xs btn-primary" onclick="openWorktree('${project.name}', '${worktree.name}')">
                                                                    Open
                                                                </button>
                                                                <button class="btn btn-xs btn-success" onclick="mergeWorktree('${project.name}', '${worktree.name}')">
                                                                    Merge
                                                                </button>
                                                                <button class="btn btn-xs btn-error" onclick="deleteWorktree('${project.name}', '${worktree.name}')">
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

async function createNewProject() {
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