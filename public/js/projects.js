// Projects and sessions management module

// Function to show sessions and projects list
async function showSessionsAndProjectsList() {
    const terminalContainer = document.getElementById('terminal-container');
    
    try {
        const [sessionsResponse, projectsResponse] = await Promise.all([
            fetch('/api/sessions'),
            fetch('/api/projects')
        ]);
        
        const sessionsData = await sessionsResponse.json();
        const projectsData = await projectsResponse.json();
        
        const sessions = sessionsData.sessions || [];
        const projects = projectsData.projects || [];
        
        terminalContainer.innerHTML = `
            <div class="p-6 bg-gray-900 text-white min-h-screen">
                <h1 class="text-3xl font-bold mb-6 text-center">MyShell Dashboard</h1>
                
                <!-- Active Sessions Section -->
                <div class="mb-8">
                    <h2 class="text-2xl font-semibold mb-4 text-green-400">Active Sessions</h2>
                    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        ${sessions.map(session => `
                            <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                <div class="flex justify-between items-start mb-2">
                                    <h3 class="text-lg font-medium text-blue-400">${session.id}</h3>
                                    <span class="text-xs px-2 py-1 bg-green-600 rounded-full">Active</span>
                                </div>
                                <p class="text-gray-300 text-sm mb-3">
                                    Project: ${session.projectName || 'None'}<br>
                                    Created: ${new Date(session.createdAt).toLocaleString()}
                                </p>
                                <div class="flex gap-2">
                                    <button onclick="window.UI.connectToSession('${session.id}', '${session.projectName || ''}')"
                                            class="flex-1 bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-sm transition-colors">
                                        Connect
                                    </button>
                                    <button onclick="window.UI.killSession('${session.id}')"
                                            class="bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-sm transition-colors">
                                        Kill
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                        ${sessions.length === 0 ? '<p class="text-gray-400 col-span-full text-center py-8">No active sessions</p>' : ''}
                    </div>
                </div>
                
                <!-- Projects Section -->
                <div>
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-2xl font-semibold text-green-400">Projects</h2>
                        <button onclick="window.Projects.createNewProject()" 
                                class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition-colors">
                            + New Project
                        </button>
                    </div>
                    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        ${projects.map(project => `
                            <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                <div class="flex justify-between items-start mb-2">
                                    <h3 class="text-lg font-medium text-purple-400">${project.name}</h3>
                                    <div class="flex gap-1">
                                        <button onclick="window.Projects.showProjectSessions('${project.name}')"
                                                class="text-blue-400 hover:text-blue-300 text-sm">
                                            📊
                                        </button>
                                        <button onclick="window.Projects.deleteProject('${project.name}')"
                                                class="text-red-400 hover:text-red-300 text-sm">
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                                <p class="text-gray-300 text-sm mb-3">
                                    Worktrees: ${project.worktrees ? project.worktrees.length : 0}<br>
                                    Created: ${new Date(project.createdAt).toLocaleString()}
                                </p>
                                <div class="flex gap-2">
                                    <button onclick="window.UI.selectProject('${project.name}')"
                                            class="flex-1 bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded text-sm transition-colors">
                                        Open
                                    </button>
                                </div>
                                ${project.worktrees && project.worktrees.length > 0 ? `
                                    <div class="mt-3 pt-3 border-t border-gray-600">
                                        <p class="text-xs text-gray-400 mb-2">Worktrees:</p>
                                        <div class="flex flex-wrap gap-1">
                                            ${project.worktrees.map(wt => `
                                                <span class="text-xs px-2 py-1 bg-gray-700 rounded">${wt.branch}</span>
                                            `).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                        ${projects.length === 0 ? '<p class="text-gray-400 col-span-full text-center py-8">No projects found</p>' : ''}
                    </div>
                </div>
            </div>
        `;
        
        window.UI.hideNavigationBar();
        
    } catch (error) {
        console.error('Error fetching data:', error);
        terminalContainer.innerHTML = `
            <div class="p-6 bg-gray-900 text-white min-h-screen">
                <h1 class="text-3xl font-bold mb-6 text-center text-red-400">Error Loading Dashboard</h1>
                <p class="text-center text-gray-300">Failed to load sessions and projects. Please try again.</p>
                <div class="text-center mt-4">
                    <button onclick="window.Projects.showSessionsAndProjectsList()" 
                            class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors">
                        Retry
                    </button>
                </div>
            </div>
        `;
    }
}

// Function to show project list
function showProjectList() {
    showSessionsAndProjectsList();
}

// Function to create new project
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
            if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
                return 'Project name can only contain letters, numbers, underscores, and hyphens!';
            }
        }
    });
    
    if (projectName) {
        try {
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: projectName })
            });
            
            const result = await response.json();
            
            if (result.success) {
                await Swal.fire({
                    title: 'Success!',
                    text: `Project "${projectName}" created successfully!`,
                    icon: 'success'
                });
                showSessionsAndProjectsList();
            } else {
                await Swal.fire({
                    title: 'Error',
                    text: 'Failed to create project: ' + result.message,
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
}

// Function to delete project
async function deleteProject(projectName) {
    const result = await Swal.fire({
        title: 'Are you sure?',
        text: `This will permanently delete the project "${projectName}" and all its data!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!'
    });
    
    if (result.isConfirmed) {
        try {
            const response = await fetch(`/api/projects/${projectName}`, {
                method: 'DELETE'
            });
            
            const deleteResult = await response.json();
            
            if (deleteResult.success) {
                await Swal.fire({
                    title: 'Deleted!',
                    text: `Project "${projectName}" has been deleted.`,
                    icon: 'success'
                });
                showSessionsAndProjectsList();
            } else {
                await Swal.fire({
                    title: 'Error',
                    text: 'Failed to delete project: ' + deleteResult.message,
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

// Function to show project sessions
async function showProjectSessions(projectName) {
    const terminalContainer = document.getElementById('terminal-container');
    
    try {
        const [sessionsResponse, worktreesResponse] = await Promise.all([
            fetch(`/api/projects/${projectName}/sessions`),
            fetch(`/api/projects/${projectName}/worktrees`)
        ]);
        
        const sessionsData = await sessionsResponse.json();
        const worktreesData = await worktreesResponse.json();
        
        const sessions = sessionsData.sessions || [];
        const worktrees = worktreesData.worktrees || [];
        
        terminalContainer.innerHTML = `
            <div class="p-6 bg-gray-900 text-white min-h-screen">
                <div class="flex items-center mb-6">
                    <button onclick="window.UI.goBackToProjectList()" 
                            class="mr-4 text-blue-400 hover:text-blue-300">
                        ← Back to Projects
                    </button>
                    <h1 class="text-3xl font-bold">Project: ${projectName}</h1>
                </div>
                
                <!-- Sessions Section -->
                <div class="mb-8">
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-2xl font-semibold text-green-400">Sessions</h2>
                        <button onclick="window.UI.createNewSessionForProject('${projectName}')" 
                                class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition-colors">
                            + New Session
                        </button>
                    </div>
                    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        ${sessions.map(session => `
                            <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                <div class="flex justify-between items-start mb-2">
                                    <h3 class="text-lg font-medium text-blue-400">${session.id}</h3>
                                    <span class="text-xs px-2 py-1 bg-green-600 rounded-full">Active</span>
                                </div>
                                <p class="text-gray-300 text-sm mb-3">
                                    Created: ${new Date(session.createdAt).toLocaleString()}
                                </p>
                                <div class="flex gap-2">
                                    <button onclick="window.UI.connectToSession('${session.id}', '${projectName}')"
                                            class="flex-1 bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-sm transition-colors">
                                        Connect
                                    </button>
                                    <button onclick="window.UI.killSession('${session.id}')"
                                            class="bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-sm transition-colors">
                                        Kill
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                        ${sessions.length === 0 ? '<p class="text-gray-400 col-span-full text-center py-8">No active sessions for this project</p>' : ''}
                    </div>
                </div>
                
                <!-- Worktrees Section -->
                <div>
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-2xl font-semibold text-purple-400">Worktrees</h2>
                        <button onclick="window.Worktrees.createWorktreeModal('${projectName}')" 
                                class="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded transition-colors">
                            + New Worktree
                        </button>
                    </div>
                    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        ${worktrees.map(worktree => `
                            <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                <div class="flex justify-between items-start mb-2">
                                    <h3 class="text-lg font-medium text-purple-400">${worktree.branch}</h3>
                                    <span class="text-xs px-2 py-1 bg-purple-600 rounded-full">Worktree</span>
                                </div>
                                <p class="text-gray-300 text-sm mb-3">
                                    Path: ${worktree.path}<br>
                                    Created: ${new Date(worktree.createdAt).toLocaleString()}
                                </p>
                                <div class="flex gap-2 mb-2">
                                    <button onclick="window.Worktrees.openWorktree('${projectName}', '${worktree.branch}')"
                                            class="flex-1 bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-sm transition-colors">
                                        Open
                                    </button>
                                    <button onclick="window.Worktrees.deleteWorktree('${projectName}', '${worktree.branch}')"
                                            class="bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-sm transition-colors">
                                        Delete
                                    </button>
                                </div>
                                <button onclick="window.Worktrees.mergeWorktree('${projectName}', '${worktree.branch}')"
                                        class="w-full bg-green-600 hover:bg-green-700 px-3 py-2 rounded text-sm transition-colors">
                                    Merge & Delete
                                </button>
                            </div>
                        `).join('')}
                        ${worktrees.length === 0 ? '<p class="text-gray-400 col-span-full text-center py-8">No worktrees for this project</p>' : ''}
                    </div>
                </div>
            </div>
        `;
        
        window.UI.hideNavigationBar();
        
    } catch (error) {
        console.error('Error fetching project data:', error);
        terminalContainer.innerHTML = `
            <div class="p-6 bg-gray-900 text-white min-h-screen">
                <h1 class="text-3xl font-bold mb-6 text-center text-red-400">Error Loading Project</h1>
                <p class="text-center text-gray-300">Failed to load project data. Please try again.</p>
                <div class="text-center mt-4">
                    <button onclick="window.Projects.showProjectSessions('${projectName}')" 
                            class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors">
                        Retry
                    </button>
                </div>
            </div>
        `;
    }
}

// Export projects functions
window.Projects = {
    showSessionsAndProjectsList,
    showProjectList,
    createNewProject,
    deleteProject,
    showProjectSessions
};