// Project and session management functionality

// Function to navigate back to session list
let sessionsStatusIntervalId = null;

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
                const el = document.getElementById(`session-status-${session.id}`);
                if (el) {
                    // Convert ANSI to HTML and preserve newlines
                    const html = ansiToHtml(session.status).replace(/\n/g, '<br/>');
                    el.innerHTML = html;
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
                                            <div class="cursor-pointer flex-1" onclick="connectToSession('${session.id}', '${session.projectName}')">
                                                <div class="flex items-center gap-2 mb-2">
                                                    <h3 class="font-semibold text-sm">${session.id}</h3>
                                                    <span class="badge badge-primary badge-sm">${session.projectName}</span>
                                                </div>
                                                <p class="text-xs opacity-70 line-clamp-6 break-all">Status: <span id="session-status-${session.id}">${ansiToHtml(session.status).replace(/\n/g, '<br/>')}</span></p>
                                                <p class="text-xs opacity-50">Created: ${new Date(session.created).toLocaleString()}</p>
                                            </div>
                                            <div class="flex gap-2">
                                                <button class="btn btn-primary btn-sm" onclick="connectToSession('${session.id}', '${session.projectName}')">
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
        startSessionsStatusAutoRefresh();
    } catch (error) {
        console.error('Failed to load sessions and projects:', error);
        const terminalContainer = document.getElementById('terminal-container');
        terminalContainer.innerHTML = '<div class="p-6 text-center text-error">Error loading sessions and projects</div>';
    }
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
    currentProject = projectName;
    sessionID = null;
    stopSessionsStatusAutoRefresh();
    initializeTerminal();
}



// Function to connect to existing session
function connectToSession(sessionId, projectName = null) {
    // Cleanup existing terminal before connecting to new session
    if (typeof cleanupTerminal === 'function') {
        cleanupTerminal();
    }
    
    sessionID = sessionId;
    currentProject = projectName || currentProject;
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