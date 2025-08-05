// Session management module

import { ansiToHtml } from './utils.js';
import { connectWebSocket, getSessionID, getCurrentProject, updateURLWithSession, updateURLWithProject } from './websocket.js';

/**
 * Show all sessions and projects list
 */
export async function showSessionsAndProjectsList() {
    try {
        // Fetch all sessions and projects with worktrees in parallel
        const [sessionsResponse, projectsResponse] = await Promise.all([
            fetch('/api/sessions'),
            fetch('/api/projects-with-worktrees')
        ]);
        
        if (!sessionsResponse.ok || !projectsResponse.ok) {
            throw new Error('Failed to fetch data from server');
        }
        
        const allSessions = await sessionsResponse.json();
        const projectsWithWorktrees = await projectsResponse.json();
        
        const terminalContainer = document.getElementById('terminal-container');
        if (!terminalContainer) {
            console.error('Terminal container not found');
            return;
        }
        
        terminalContainer.innerHTML = generateSessionsAndProjectsHTML(allSessions, projectsWithWorktrees);
        
    } catch (error) {
        console.error('Failed to load sessions and projects:', error);
        const terminalContainer = document.getElementById('terminal-container');
        if (terminalContainer) {
            terminalContainer.innerHTML = '<div class="p-6 text-center text-error">Error loading sessions and projects</div>';
        }
    }
}

/**
 * Show sessions for a specific project
 * @param {string} projectName - Name of the project
 */
export async function showProjectSessions(projectName) {
    try {
        // Fetch both sessions and worktrees in parallel
        const [sessionsResponse, worktreesResponse] = await Promise.all([
            fetch(`/api/projects/${encodeURIComponent(projectName)}/sessions`),
            fetch(`/api/projects/${encodeURIComponent(projectName)}/worktrees`)
        ]);
        
        if (!sessionsResponse.ok || !worktreesResponse.ok) {
            throw new Error('Failed to fetch project data');
        }
        
        const sessions = await sessionsResponse.json();
        const worktrees = await worktreesResponse.json();
        
        const terminalContainer = document.getElementById('terminal-container');
        if (!terminalContainer) {
            console.error('Terminal container not found');
            return;
        }
        
        terminalContainer.innerHTML = generateProjectSessionsHTML(projectName, sessions, worktrees);
        
    } catch (error) {
        console.error('Error fetching project data:', error);
        const terminalContainer = document.getElementById('terminal-container');
        if (terminalContainer) {
            terminalContainer.innerHTML = '<div class="p-6 text-center text-error">Error loading project data</div>';
        }
    }
}

/**
 * Connect to an existing session
 * @param {string} sessionId - Session ID to connect to
 * @param {string} projectName - Optional project name
 */
export function connectToSession(sessionId, projectName = null) {
    const project = projectName || getCurrentProject();
    updateURLWithSession(sessionId, project);
    
    // Import and initialize terminal here to avoid circular dependency
    import('./main.js').then(main => {
        main.initializeTerminal();
    });
}

/**
 * Kill a session
 * @param {string} sessionId - Session ID to kill
 */
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
                text: 'Failed to kill session: ' + (result.message || 'Unknown error'),
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

/**
 * Create new session for project
 * @param {string} projectName - Project name
 */
export function createNewSessionForProject(projectName) {
    updateURLWithProject(projectName);
    
    // Import and initialize terminal here to avoid circular dependency
    import('./main.js').then(main => {
        main.initializeTerminal();
    });
}

/**
 * Generate HTML for sessions and projects list
 * @param {Array} allSessions - All sessions data
 * @param {Array} projectsWithWorktrees - Projects with worktrees data
 * @returns {string} - Generated HTML
 */
function generateSessionsAndProjectsHTML(allSessions, projectsWithWorktrees) {
    return `
        <div class="p-6 max-w-6xl mx-auto h-full flex flex-col overflow-y-auto">
            <h1 class="text-3xl font-bold mb-8 text-center">Shell Dashboard</h1>
            
            <!-- All Sessions Section -->
            <div class="mb-8">
                <h2 class="text-2xl font-semibold mb-4 flex items-center gap-2">
                    <span class="text-primary">🖥️</span> All Active Sessions
                </h2>
                <div class="grid gap-3 mb-6">
                    ${allSessions.length === 0 ? '<p class="text-center opacity-70 py-4">No active sessions</p>' : 
                        allSessions.map(session => generateSessionCardHTML(session)).join('')
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
                        <button class="btn btn-primary" onclick="window.projectsModule.createNewProject()">Create Project</button>
                    </div>
                </div>
                <div class="grid gap-4">
                    ${projectsWithWorktrees.length === 0 ? '<p class="text-center opacity-70 py-4">No projects found</p>' : 
                        projectsWithWorktrees.map(project => generateProjectCardHTML(project)).join('')
                    }
                </div>
            </div>
        </div>
    `;
}

/**
 * Generate HTML for project sessions view
 * @param {string} projectName - Project name
 * @param {Array} sessions - Sessions data
 * @param {Array} worktrees - Worktrees data
 * @returns {string} - Generated HTML
 */
function generateProjectSessionsHTML(projectName, sessions, worktrees) {
    return `
        <div class="p-6 max-w-4xl mx-auto">
            <div class="mb-6">
                <button class="btn btn-outline" onclick="window.navigationModule.goBackToProjectList()">← Back to Projects</button>
            </div>
            <h1 class="text-2xl font-bold mb-6 text-center">Project: ${projectName}</h1>
            
            <!-- Sessions Section -->
            <div class="mb-8">
                <h2 class="text-xl font-semibold mb-4">Terminal Sessions</h2>
                <div class="grid gap-4 mb-6">
                    ${sessions.length === 0 ? '<p class="text-center opacity-70">No active sessions for this project</p>' : 
                        sessions.map(session => generateProjectSessionCardHTML(session, projectName)).join('')
                    }
                </div>
                <div class="text-center">
                    <button class="btn btn-primary" onclick="window.sessionsModule.createNewSessionForProject('${projectName}')">Create New Session</button>
                </div>
            </div>

            <!-- Worktrees Section -->
            <div class="mb-8">
                <h2 class="text-xl font-semibold mb-4">Git Worktrees</h2>
                <div class="grid gap-4 mb-6">
                    ${worktrees.length === 0 ? '<p class="text-center opacity-70">No worktrees for this project</p>' : 
                        worktrees.map(worktree => generateWorktreeCardHTML(worktree, projectName)).join('')
                    }
                </div>
                <div class="text-center">
                    <button class="btn btn-secondary" onclick="window.worktreesModule.createWorktreeModal('${projectName}')">Create New Worktree</button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Generate HTML for a session card
 * @param {Object} session - Session data
 * @returns {string} - Generated HTML
 */
function generateSessionCardHTML(session) {
    return `
        <div class="card bg-base-200 shadow-lg hover:shadow-xl transition-shadow">
            <div class="card-body p-4">
                <div class="flex justify-between items-start">
                    <div class="cursor-pointer flex-1" onclick="window.sessionsModule.connectToSession('${session.id}', '${session.projectName}')">
                        <div class="flex items-center gap-2 mb-2">
                            <h3 class="font-semibold text-sm">${session.id}</h3>
                            <span class="badge badge-primary badge-sm">${session.projectName}</span>
                        </div>
                        <p class="text-xs opacity-70 line-clamp-2 break-all">Status: <span>${ansiToHtml(session.status)}</span></p>
                        <p class="text-xs opacity-50">Created: ${new Date(session.created).toLocaleString()}</p>
                    </div>
                    <div class="flex gap-2">
                        <button class="btn btn-primary btn-sm" onclick="window.sessionsModule.connectToSession('${session.id}', '${session.projectName}')">
                            Connect
                        </button>
                        <button class="btn btn-error btn-sm" onclick="window.sessionsModule.killSession('${session.id}')">
                            Kill
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Generate HTML for a project session card
 * @param {Object} session - Session data
 * @param {string} projectName - Project name
 * @returns {string} - Generated HTML
 */
function generateProjectSessionCardHTML(session, projectName) {
    return `
        <div class="card bg-base-200 shadow-xl">
            <div class="card-body p-4">
                <div class="flex justify-between items-start">
                    <div class="cursor-pointer flex-1" onclick="window.sessionsModule.connectToSession('${session.id}', '${projectName}')">
                        <h2 class="card-title text-sm">${session.id}</h2>
                        <p class="text-xs opacity-70 line-clamp-5 break-all">Status: <span>${ansiToHtml(session.status)}</span></p>
                        <p class="text-xs opacity-50">Created: ${new Date(session.created).toLocaleString()}</p>
                    </div>
                    <div class="flex gap-2">
                        <button class="btn btn-primary btn-sm" onclick="window.sessionsModule.connectToSession('${session.id}', '${projectName}')">
                            Connect
                        </button>
                        <button class="btn btn-error btn-sm" onclick="window.sessionsModule.killSession('${session.id}')">
                            Kill
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Generate HTML for a project card
 * @param {Object} project - Project data
 * @returns {string} - Generated HTML
 */
function generateProjectCardHTML(project) {
    return `
        <div class="card bg-base-300 shadow-lg">
            <div class="card-body p-4">
                <div class="flex justify-between items-center mb-4">
                    <div class="cursor-pointer flex-1" onclick="window.projectsModule.selectProject('${project.name}')">
                        <h3 class="text-lg font-bold">${project.name}</h3>
                    </div>
                    <div class="flex gap-2">
                        <button class="btn btn-primary btn-sm" onclick="window.projectsModule.selectProject('${project.name}')">
                            Open Project
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="window.worktreesModule.createWorktreeModal('${project.name}')">
                            + Worktree
                        </button>
                        <button class="btn btn-error btn-sm" onclick="window.projectsModule.deleteProject('${project.name}')">
                            Delete
                        </button>
                    </div>
                </div>
                
                <!-- Worktrees for this project -->
                ${project.worktrees.length > 0 ? `
                    <div class="mt-3">
                        <h4 class="text-sm font-semibold mb-2 opacity-80">Worktrees:</h4>
                        <div class="grid gap-2">
                            ${project.worktrees.map(worktree => generateInlineWorktreeHTML(worktree, project.name)).join('')}
                        </div>
                    </div>
                ` : '<p class="text-xs opacity-50 mt-2">No worktrees</p>'}
            </div>
        </div>
    `;
}

/**
 * Generate HTML for a worktree card
 * @param {Object} worktree - Worktree data
 * @param {string} projectName - Project name
 * @returns {string} - Generated HTML
 */
function generateWorktreeCardHTML(worktree, projectName) {
    return `
        <div class="card bg-base-300 shadow-xl">
            <div class="card-body p-4">
                <div class="flex justify-between items-start">
                    <div class="cursor-pointer flex-1" onclick="window.worktreesModule.openWorktree('${projectName}', '${worktree.name}')">
                        <h2 class="card-title text-sm">🌿 ${worktree.name}</h2>
                        <p class="text-xs opacity-70">Branch: ${worktree.branch || 'detached'}</p>
                        <p class="text-xs opacity-50">Path: ${worktree.relativePath}</p>
                    </div>
                    <div class="flex gap-2">
                        <button class="btn btn-primary btn-sm" onclick="window.worktreesModule.openWorktree('${projectName}', '${worktree.name}')">
                            Open
                        </button>
                        <button class="btn btn-success btn-sm" onclick="window.worktreesModule.mergeWorktree('${projectName}', '${worktree.name}')">
                            Merge
                        </button>
                        <button class="btn btn-error btn-sm" onclick="window.worktreesModule.deleteWorktree('${projectName}', '${worktree.name}')">
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Generate HTML for inline worktree display
 * @param {Object} worktree - Worktree data
 * @param {string} projectName - Project name
 * @returns {string} - Generated HTML
 */
function generateInlineWorktreeHTML(worktree, projectName) {
    return `
        <div class="bg-base-100 rounded-lg p-3 flex justify-between items-center">
            <div class="cursor-pointer flex-1" onclick="window.worktreesModule.openWorktree('${projectName}', '${worktree.name}')">
                <div class="flex items-center gap-2">
                    <span class="text-success">🌿</span>
                    <span class="font-medium text-sm">${worktree.name}</span>
                    <span class="badge badge-outline badge-xs">${worktree.branch}</span>
                </div>
                <p class="text-xs opacity-60 mt-1">${worktree.relativePath}</p>
            </div>
            <div class="flex gap-1">
                <button class="btn btn-xs btn-primary" onclick="window.worktreesModule.openWorktree('${projectName}', '${worktree.name}')">
                    Open
                </button>
                <button class="btn btn-xs btn-success" onclick="window.worktreesModule.mergeWorktree('${projectName}', '${worktree.name}')">
                    Merge
                </button>
                <button class="btn btn-xs btn-error" onclick="window.worktreesModule.deleteWorktree('${projectName}', '${worktree.name}')">
                    Delete
                </button>
            </div>
        </div>
    `;
} 