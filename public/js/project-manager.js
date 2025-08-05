// Project and session management module

// Function to show navigation bar
function showNavigationBar() {
    const navbar = document.getElementById('navigation-bar');
    if (navbar) {
        navbar.classList.remove('hidden');
    }
}

function hideNavigationBar() {
    const navbar = document.getElementById('navigation-bar');
    if (navbar) {
        navbar.classList.add('hidden');
    }
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
                                            <div class="cursor-pointer flex-1" onclick="connectToSession('${session.id}', '${session.projectName}')">
                                                <div class="flex items-center gap-2 mb-2">
                                                    <h3 class="font-semibold text-sm">${session.id}</h3>
                                                    <span class="badge badge-primary badge-sm">${session.projectName}</span>
                                                </div>
                                                <p class="text-xs opacity-70 line-clamp-2 break-all">Status: <span>${window.utils.ansiToHtml(session.status)}</span></p>
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
                                                <button class="btn btn-secondary btn-sm" onclick="window.worktreeManager.createWorktreeModal('${project.name}')">
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
                                                            <div class="cursor-pointer flex-1" onclick="window.worktreeManager.openWorktree('${project.name}', '${worktree.name}')">
                                                                <div class="flex items-center gap-2">
                                                                    <span class="text-success">🌿</span>
                                                                    <span class="font-medium text-sm">${worktree.name}</span>
                                                                    <span class="badge badge-outline badge-xs">${worktree.branch}</span>
                                                                </div>
                                                                <p class="text-xs opacity-60 mt-1">${worktree.relativePath}</p>
                                                            </div>
                                                            <div class="flex gap-1">
                                                                <button class="btn btn-xs btn-primary" onclick="window.worktreeManager.openWorktree('${project.name}', '${worktree.name}')">
                                                                    Open
                                                                </button>
                                                                <button class="btn btn-xs btn-success" onclick="window.worktreeManager.mergeWorktree('${project.name}', '${worktree.name}')">
                                                                    Merge
                                                                </button>
                                                                <button class="btn btn-xs btn-error" onclick="window.worktreeManager.deleteWorktree('${project.name}', '${worktree.name}')">
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

async function showProjectList() {
    // Hide navigation bar when showing project list
    hideNavigationBar();
    
    try {
        const response = await fetch('/api/projects');
        const projects = await response.json();
        
        const terminalContainer = document.getElementById('terminal-container');
        terminalContainer.innerHTML = `
            <div class="p-6 max-w-4xl mx-auto h-full flex flex-col">
                <h1 class="text-2xl font-bold mb-6 text-center">Projects</h1>
                <div class="mb-6">
                    <div class="flex gap-2">
                        <input type="text" id="project-name" placeholder="Enter project name" class="input input-bordered flex-1">
                        <button class="btn btn-primary" onclick="createNewProject()">Create Project</button>
                    </div>
                </div>
                <div class="projects-container grid gap-4">
                    ${projects.length === 0 ? '<p class="text-center opacity-70">No projects found</p>' : 
                        projects.map(project => `
                            <div class="card bg-base-200 shadow-xl">
                                <div class="card-body p-4">
                                    <div class="flex justify-between items-center">
                                        <div class="cursor-pointer flex-1" onclick="selectProject('${project}')">
                                            <h2 class="card-title text-sm">${project}</h2>
                                        </div>
                                        <div class="flex gap-2">
                                            <button class="btn btn-primary btn-sm" onclick="selectProject('${project}')">
                                                Open
                                            </button>
                                            <button class="btn btn-secondary btn-sm" onclick="window.worktreeManager.createWorktreeModal('${project}')">
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
    window.urlUtils.updateURLWithProject(projectName);
    showProjectSessions(projectName);
}

async function showProjectSessions(projectName) {
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
                    <button class="btn btn-outline" onclick="window.urlUtils.goBackToProjectList()">← Back to Projects</button>
                </div>
                <h1 class="text-2xl font-bold mb-6 text-center">Project: ${projectName}</h1>
                
                <!-- Sessions Section -->
                <div class="mb-8">
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-xl font-semibold">Active Sessions</h2>
                        <button class="btn btn-primary" onclick="createNewSessionForProject('${projectName}')">New Session</button>
                    </div>
                    <div class="grid gap-3">
                        ${sessions.length === 0 ? '<p class="text-center opacity-70 py-4">No active sessions for this project</p>' : 
                            sessions.map(session => `
                                <div class="card bg-base-200 shadow-lg hover:shadow-xl transition-shadow">
                                    <div class="card-body p-4">
                                        <div class="flex justify-between items-start">
                                            <div class="cursor-pointer flex-1" onclick="connectToSession('${session.id}', '${projectName}')">
                                                <h3 class="font-semibold text-sm mb-1">${session.id}</h3>
                                                <p class="text-xs opacity-70 line-clamp-2 break-all">Status: <span>${window.utils.ansiToHtml(session.status)}</span></p>
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
                </div>
                
                <!-- Worktrees Section -->
                <div class="mb-8">
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-xl font-semibold">Worktrees</h2>
                        <button class="btn btn-secondary" onclick="window.worktreeManager.createWorktreeModal('${projectName}')">+ New Worktree</button>
                    </div>
                    <div class="grid gap-3">
                        ${worktrees.length === 0 ? '<p class="text-center opacity-70 py-4">No worktrees for this project</p>' : 
                            worktrees.map(worktree => `
                                <div class="card bg-base-100 shadow-lg">
                                    <div class="card-body p-4">
                                        <div class="flex justify-between items-center">
                                            <div class="cursor-pointer flex-1" onclick="window.worktreeManager.openWorktree('${projectName}', '${worktree.name}')">
                                                <div class="flex items-center gap-2 mb-1">
                                                    <span class="text-success">🌿</span>
                                                    <h3 class="font-semibold text-sm">${worktree.name}</h3>
                                                    <span class="badge badge-outline badge-xs">${worktree.branch}</span>
                                                </div>
                                                <p class="text-xs opacity-60">${worktree.relativePath}</p>
                                            </div>
                                            <div class="flex gap-2">
                                                <button class="btn btn-primary btn-sm" onclick="window.worktreeManager.openWorktree('${projectName}', '${worktree.name}')">
                                                    Open
                                                </button>
                                                <button class="btn btn-success btn-sm" onclick="window.worktreeManager.mergeWorktree('${projectName}', '${worktree.name}')">
                                                    Merge
                                                </button>
                                                <button class="btn btn-error btn-sm" onclick="window.worktreeManager.deleteWorktree('${projectName}', '${worktree.name}')">
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Failed to load project sessions:', error);
        const terminalContainer = document.getElementById('terminal-container');
        terminalContainer.innerHTML = '<div class="p-6 text-center text-error">Error loading project sessions</div>';
    }
}

function connectToSession(sessionId, projectName = null) {
    sessionID = sessionId;
    currentProject = projectName;
    window.terminalModule.initializeTerminal();
}

async function killSession(sessionId) {
    const confirmKill = confirm(`Are you sure you want to kill session ${sessionId}?`);
    if (!confirmKill) return;
    
    try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Refresh the current view
            if (currentProject) {
                showProjectSessions(currentProject);
            } else {
                showSessionsAndProjectsList();
            }
        } else {
            alert(result.error || 'Failed to kill session');
        }
    } catch (error) {
        console.error('Error killing session:', error);
        alert('Error killing session');
    }
}

function createNewSessionForProject(projectName) {
    sessionID = null;
    currentProject = projectName;
    window.terminalModule.initializeTerminal();
}

// Export functions for use in other modules
window.projectManager = {
    showNavigationBar,
    hideNavigationBar,
    showSessionsAndProjectsList,
    showProjectList,
    createNewProject,
    selectProject,
    showProjectSessions,
    connectToSession,
    killSession,
    createNewSessionForProject
};

// Make functions globally available for onclick handlers
window.connectToSession = connectToSession;
window.killSession = killSession;
window.createNewProject = createNewProject;
window.selectProject = selectProject;
window.createNewSessionForProject = createNewSessionForProject;