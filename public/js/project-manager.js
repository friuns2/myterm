// Project management module

async function showSessionsAndProjectsList() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    try {
        // Fetch all sessions and projects with worktrees in parallel
        const [sessionsResponse, projectsResponse] = await Promise.all([
            fetch('/api/sessions'),
            fetch('/api/projects-with-worktrees')
        ]);

        const sessions = await sessionsResponse.json();
        const projects = await projectsResponse.json();

        let html = `
            <div class="p-6">
                <h1 class="text-3xl font-bold mb-6 text-center">Shell Dashboard</h1>
                
                <!-- All Active Sessions Section -->
                <div class="mb-8">
                    <h2 class="text-2xl font-semibold mb-4 flex items-center">
                        <span class="mr-2">🖥️</span> All Active Sessions
                    </h2>
                    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        `;

        if (sessions.length === 0) {
            html += `
                <div class="col-span-full">
                    <div class="card bg-base-200 shadow-xl">
                        <div class="card-body text-center">
                            <p class="text-base-content/70">No active sessions</p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            sessions.forEach(session => {
                const statusColor = session.status.includes('$') ? 'badge-success' : 'badge-warning';
                html += `
                    <div class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
                        <div class="card-body">
                            <h3 class="card-title text-lg">
                                ${session.projectName || 'No Project'}
                                <div class="badge ${statusColor}">Active</div>
                            </h3>
                            <p class="text-sm text-base-content/70 mb-2">
                                Session: ${session.id.substring(0, 8)}...
                            </p>
                            <p class="text-xs text-base-content/50 mb-3">
                                Created: ${new Date(session.createdAt).toLocaleString()}
                            </p>
                            <div class="text-xs font-mono bg-base-200 p-2 rounded mb-3 max-h-16 overflow-hidden">
                                ${session.status}
                            </div>
                            <div class="card-actions justify-end">
                                <button class="btn btn-primary btn-sm" onclick="connectToSession('${session.id}', '${session.projectName || ''}')">Connect</button>
                                <button class="btn btn-error btn-sm" onclick="killSession('${session.id}')">Kill</button>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        html += `
                    </div>
                </div>
                
                <!-- All Projects & Worktrees Section -->
                <div>
                    <h2 class="text-2xl font-semibold mb-4 flex items-center">
                        <span class="mr-2">📁</span> All Projects & Worktrees
                    </h2>
                    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        `;

        if (projects.length === 0) {
            html += `
                <div class="col-span-full">
                    <div class="card bg-base-200 shadow-xl">
                        <div class="card-body text-center">
                            <p class="text-base-content/70 mb-4">No projects found</p>
                            <button class="btn btn-primary" onclick="createNewProject()">Create New Project</button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            projects.forEach(project => {
                html += `
                    <div class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
                        <div class="card-body">
                            <h3 class="card-title text-lg">
                                📁 ${project.name}
                                <div class="badge badge-info">${project.worktrees.length} worktree${project.worktrees.length !== 1 ? 's' : ''}</div>
                            </h3>
                            
                            <!-- Worktrees -->
                            <div class="mt-3">
                `;

                if (project.worktrees.length === 0) {
                    html += `<p class="text-sm text-base-content/70">No worktrees</p>`;
                } else {
                    project.worktrees.forEach(worktree => {
                        html += `
                            <div class="flex items-center justify-between bg-base-200 p-2 rounded mb-2">
                                <div>
                                    <span class="text-sm font-medium">${worktree.name}</span>
                                    <span class="text-xs text-base-content/70 ml-2">(${worktree.branch})</span>
                                </div>
                                <div class="flex gap-1">
                                    <button class="btn btn-xs btn-primary" onclick="openWorktree('${project.name}', '${worktree.name}')">Open</button>
                                    <button class="btn btn-xs btn-warning" onclick="mergeWorktree('${project.name}', '${worktree.name}')">Merge</button>
                                    <button class="btn btn-xs btn-error" onclick="deleteWorktree('${project.name}', '${worktree.name}')">Delete</button>
                                </div>
                            </div>
                        `;
                    });
                }

                html += `
                            </div>
                            
                            <div class="card-actions justify-end mt-4">
                                <button class="btn btn-success btn-sm" onclick="selectProject('${project.name}')">Open Terminal</button>
                                <button class="btn btn-info btn-sm" onclick="createWorktreeModal('${project.name}')">Add Worktree</button>
                            </div>
                        </div>
                    </div>
                `;
            });

            // Add "Create New Project" card
            html += `
                <div class="card bg-base-200 shadow-xl hover:shadow-2xl transition-shadow border-2 border-dashed border-base-300">
                    <div class="card-body text-center">
                        <h3 class="card-title justify-center text-lg text-base-content/70">
                            ➕ Create New Project
                        </h3>
                        <p class="text-sm text-base-content/50 mb-4">Start a new project</p>
                        <button class="btn btn-primary" onclick="createNewProject()">Create Project</button>
                    </div>
                </div>
            `;
        }

        html += `
                    </div>
                </div>
            </div>
        `;

        mainContent.innerHTML = html;
        window.UIModule.hideNavigationBar();

    } catch (error) {
        console.error('Error loading dashboard:', error);
        mainContent.innerHTML = `
            <div class="p-6 text-center">
                <h1 class="text-2xl font-bold mb-4 text-error">Error Loading Dashboard</h1>
                <p class="text-base-content/70">Failed to load sessions and projects. Please try refreshing the page.</p>
            </div>
        `;
    }
}

async function showProjectList() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    try {
        const response = await fetch('/api/projects');
        const projects = await response.json();

        let html = `
            <div class="p-6">
                <h1 class="text-3xl font-bold mb-6 text-center">Projects</h1>
                <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        `;

        projects.forEach(project => {
            html += `
                <div class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow cursor-pointer" onclick="selectProject('${project}')">
                    <div class="card-body">
                        <h2 class="card-title">📁 ${project}</h2>
                        <p class="text-base-content/70">Click to open project</p>
                        <div class="card-actions justify-end">
                            <button class="btn btn-primary btn-sm">Open</button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                <div class="card bg-base-200 shadow-xl hover:shadow-2xl transition-shadow border-2 border-dashed border-base-300 cursor-pointer" onclick="createNewProject()">
                    <div class="card-body text-center">
                        <h2 class="card-title justify-center text-base-content/70">➕ Create New Project</h2>
                        <p class="text-base-content/50">Start a new project</p>
                    </div>
                </div>
            </div>
        </div>
        `;

        mainContent.innerHTML = html;
        window.UIModule.hideNavigationBar();
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

async function createNewProject() {
    const { value: projectName } = await Swal.fire({
        title: 'Create New Project',
        input: 'text',
        inputLabel: 'Project Name',
        inputPlaceholder: 'Enter project name',
        showCancelButton: true,
        inputValidator: (value) => {
            if (!value) {
                return 'You need to enter a project name!';
            }
        }
    });
    
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
            // Redirect to the new project
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

function selectProject(projectName) {
    window.currentProject = projectName;
    window.sessionID = null;
    window.URLModule.updateURLWithProject(projectName);
    window.TerminalModule.initializeTerminal();
}

async function showProjectSessions(projectName) {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    try {
        // Fetch both sessions and worktrees for this project
        const [sessionsResponse, worktreesResponse] = await Promise.all([
            fetch(`/api/projects/${encodeURIComponent(projectName)}/sessions`),
            fetch(`/api/projects/${encodeURIComponent(projectName)}/worktrees`)
        ]);

        const sessions = await sessionsResponse.json();
        const worktrees = await worktreesResponse.json();

        let html = `
            <div class="p-6">
                <div class="flex items-center justify-between mb-6">
                    <h1 class="text-3xl font-bold">📁 ${projectName}</h1>
                    <button class="btn btn-ghost" onclick="goBackToProjectList()">← Back to Projects</button>
                </div>
                
                <!-- Sessions Section -->
                <div class="mb-8">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-2xl font-semibold">🖥️ Sessions</h2>
                        <button class="btn btn-primary" onclick="createNewSessionForProject('${projectName}')">New Session</button>
                    </div>
                    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        `;

        if (sessions.length === 0) {
            html += `
                <div class="col-span-full">
                    <div class="card bg-base-200 shadow-xl">
                        <div class="card-body text-center">
                            <p class="text-base-content/70">No active sessions for this project</p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            sessions.forEach(session => {
                const statusColor = session.status.includes('$') ? 'badge-success' : 'badge-warning';
                html += `
                    <div class="card bg-base-100 shadow-xl">
                        <div class="card-body">
                            <h3 class="card-title">
                                Session
                                <div class="badge ${statusColor}">Active</div>
                            </h3>
                            <p class="text-sm text-base-content/70">ID: ${session.id.substring(0, 8)}...</p>
                            <p class="text-xs text-base-content/50">Created: ${new Date(session.createdAt).toLocaleString()}</p>
                            <div class="text-xs font-mono bg-base-200 p-2 rounded mb-3 max-h-16 overflow-hidden">
                                ${session.status}
                            </div>
                            <div class="card-actions justify-end">
                                <button class="btn btn-primary btn-sm" onclick="connectToSession('${session.id}', '${projectName}')">Connect</button>
                                <button class="btn btn-error btn-sm" onclick="killSession('${session.id}')">Kill</button>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        html += `
                    </div>
                </div>
                
                <!-- Worktrees Section -->
                <div>
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-2xl font-semibold">🌿 Worktrees</h2>
                        <button class="btn btn-secondary" onclick="createWorktreeModal('${projectName}')">New Worktree</button>
                    </div>
                    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        `;

        if (worktrees.length === 0) {
            html += `
                <div class="col-span-full">
                    <div class="card bg-base-200 shadow-xl">
                        <div class="card-body text-center">
                            <p class="text-base-content/70">No worktrees for this project</p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            worktrees.forEach(worktree => {
                html += `
                    <div class="card bg-base-100 shadow-xl">
                        <div class="card-body">
                            <h3 class="card-title">
                                🌿 ${worktree.worktree}
                                <div class="badge badge-info">${worktree.branch}</div>
                            </h3>
                            <p class="text-sm text-base-content/70">${worktree.path}</p>
                            <div class="card-actions justify-end mt-4">
                                <button class="btn btn-primary btn-sm" onclick="openWorktree('${projectName}', '${worktree.worktree}')">Open</button>
                                <button class="btn btn-warning btn-sm" onclick="mergeWorktree('${projectName}', '${worktree.worktree}')">Merge</button>
                                <button class="btn btn-error btn-sm" onclick="deleteWorktree('${projectName}', '${worktree.worktree}')">Delete</button>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        html += `
                    </div>
                </div>
            </div>
        `;

        mainContent.innerHTML = html;
        window.UIModule.hideNavigationBar();

    } catch (error) {
        console.error('Error loading project sessions:', error);
    }
}

function connectToSession(sessionId, projectName = null) {
    window.sessionID = sessionId;
    window.currentProject = projectName;
    window.URLModule.updateURLWithSession(sessionId, projectName);
    window.TerminalModule.initializeTerminal();
}

async function killSession(sessionId) {
    try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Refresh the current view
            if (window.currentProject) {
                showProjectSessions(window.currentProject);
            } else {
                showSessionsAndProjectsList();
            }
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

function createNewSessionForProject(projectName) {
    window.sessionID = null;
    window.currentProject = projectName;
    window.URLModule.updateURLWithProject(projectName);
    window.TerminalModule.initializeTerminal();
}

// Export functions for use in other modules
window.ProjectModule = {
    showSessionsAndProjectsList,
    showProjectList,
    createNewProject,
    selectProject,
    showProjectSessions,
    connectToSession,
    killSession,
    createNewSessionForProject
};