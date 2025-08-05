// UI management module
class UIManager {
    constructor() {
        this.currentView = null;
        this.isNavigationVisible = false;
    }

    // Show project list view
    async showProjectList() {
        this.currentView = 'projects';
        this.hideNavigationBar();
        
        try {
            const projects = await window.apiClient.getProjects();
            this.renderProjectList(projects);
        } catch (error) {
            console.error('Failed to load projects:', error);
            this.showError('Failed to load projects');
        }
    }

    // Render project list HTML
    renderProjectList(projects) {
        const container = document.getElementById('terminal-container');
        container.innerHTML = `
            <div class="p-6 max-w-4xl mx-auto">
                <h1 class="text-3xl font-bold mb-6 text-green-400">Projects</h1>
                <div class="mb-4">
                    <button id="create-project-btn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                        Create New Project
                    </button>
                </div>
                <div class="grid gap-4">
                    ${projects.map(project => `
                        <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 hover:border-green-500 cursor-pointer project-item" data-project="${project}">
                            <h3 class="text-xl font-semibold text-green-400">${project}</h3>
                            <p class="text-gray-400">Click to view sessions and worktrees</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        this.setupProjectListEvents();
    }

    // Setup event listeners for project list
    setupProjectListEvents() {
        // Project selection
        document.querySelectorAll('.project-item').forEach(item => {
            item.addEventListener('click', () => {
                const projectName = item.dataset.project;
                window.urlManager.navigateToSessionList(projectName);
            });
        });

        // Create project button
        document.getElementById('create-project-btn')?.addEventListener('click', () => {
            this.showCreateProjectModal();
        });
    }

    // Show session list for a project
    async showSessionList(projectName) {
        this.currentView = 'sessions';
        this.showNavigationBar();
        
        try {
            const [sessions, worktrees] = await Promise.all([
                window.apiClient.getSessions(projectName),
                window.apiClient.getWorktrees(projectName)
            ]);
            this.renderSessionList(projectName, sessions, worktrees);
        } catch (error) {
            console.error('Failed to load sessions:', error);
            this.showError('Failed to load sessions');
        }
    }

    // Render session list HTML
    renderSessionList(projectName, sessions, worktrees) {
        const container = document.getElementById('terminal-container');
        container.innerHTML = `
            <div class="p-6 max-w-6xl mx-auto">
                <div class="flex justify-between items-center mb-6">
                    <h1 class="text-3xl font-bold text-green-400">${projectName}</h1>
                    <div class="space-x-2">
                        <button id="file-browser-btn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
                            File Browser
                        </button>
                        <button id="create-session-btn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                            New Session
                        </button>
                    </div>
                </div>
                
                <div class="grid md:grid-cols-2 gap-6">
                    <!-- Sessions -->
                    <div>
                        <h2 class="text-2xl font-semibold mb-4 text-green-400">Active Sessions</h2>
                        <div class="space-y-2">
                            ${sessions.length > 0 ? sessions.map(session => `
                                <div class="bg-gray-800 p-3 rounded border border-gray-700 hover:border-green-500 flex justify-between items-center">
                                    <div class="cursor-pointer flex-1 session-item" data-session="${session.id}">
                                        <div class="font-medium text-green-400">${session.id}</div>
                                        <div class="text-sm text-gray-400">PID: ${session.pid}</div>
                                    </div>
                                    <button class="kill-session-btn text-red-400 hover:text-red-300 ml-2" data-session="${session.id}">
                                        ✕
                                    </button>
                                </div>
                            `).join('') : '<p class="text-gray-400">No active sessions</p>'}
                        </div>
                    </div>
                    
                    <!-- Worktrees -->
                    <div>
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-2xl font-semibold text-green-400">Git Worktrees</h2>
                            <button id="create-worktree-btn" class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm">
                                New Worktree
                            </button>
                        </div>
                        <div class="space-y-2">
                            ${worktrees.length > 0 ? worktrees.map(worktree => `
                                <div class="bg-gray-800 p-3 rounded border border-gray-700">
                                    <div class="flex justify-between items-start">
                                        <div>
                                            <div class="font-medium text-purple-400">${worktree.name}</div>
                                            <div class="text-sm text-gray-400">${worktree.branch}</div>
                                            <div class="text-xs text-gray-500">${worktree.path}</div>
                                        </div>
                                        <div class="flex space-x-1">
                                            <button class="open-worktree-btn text-blue-400 hover:text-blue-300 text-sm" data-worktree="${worktree.name}">
                                                Open
                                            </button>
                                            <button class="merge-worktree-btn text-green-400 hover:text-green-300 text-sm" data-worktree="${worktree.name}">
                                                Merge
                                            </button>
                                            <button class="delete-worktree-btn text-red-400 hover:text-red-300 text-sm" data-worktree="${worktree.name}">
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `).join('') : '<p class="text-gray-400">No worktrees found</p>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.setupSessionListEvents(projectName);
    }

    // Setup event listeners for session list
    setupSessionListEvents(projectName) {
        // Session selection
        document.querySelectorAll('.session-item').forEach(item => {
            item.addEventListener('click', () => {
                const sessionID = item.dataset.session;
                window.urlManager.navigateToTerminal(sessionID, projectName);
            });
        });

        // Kill session buttons
        document.querySelectorAll('.kill-session-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const sessionID = btn.dataset.session;
                if (confirm(`Kill session ${sessionID}?`)) {
                    try {
                        await window.apiClient.killSession(projectName, sessionID);
                        this.showSessionList(projectName); // Refresh
                    } catch (error) {
                        this.showError('Failed to kill session');
                    }
                }
            });
        });

        // Create session button
        document.getElementById('create-session-btn')?.addEventListener('click', () => {
            window.urlManager.navigateToTerminal(null, projectName);
        });

        // File browser button
        document.getElementById('file-browser-btn')?.addEventListener('click', () => {
            window.fileBrowser.show(projectName);
        });

        // Worktree buttons
        this.setupWorktreeEvents(projectName);

        // Create worktree button
        document.getElementById('create-worktree-btn')?.addEventListener('click', () => {
            this.showCreateWorktreeModal(projectName);
        });
    }

    // Setup worktree event listeners
    setupWorktreeEvents(projectName) {
        document.querySelectorAll('.open-worktree-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const worktreeName = btn.dataset.worktree;
                try {
                    await window.apiClient.openWorktree(projectName, worktreeName);
                    this.showSuccess(`Opened worktree: ${worktreeName}`);
                } catch (error) {
                    this.showError('Failed to open worktree');
                }
            });
        });

        document.querySelectorAll('.merge-worktree-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const worktreeName = btn.dataset.worktree;
                if (confirm(`Merge worktree ${worktreeName} into main branch?`)) {
                    try {
                        await window.apiClient.mergeWorktree(projectName, worktreeName);
                        this.showSuccess(`Merged worktree: ${worktreeName}`);
                        this.showSessionList(projectName); // Refresh
                    } catch (error) {
                        this.showError('Failed to merge worktree');
                    }
                }
            });
        });

        document.querySelectorAll('.delete-worktree-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const worktreeName = btn.dataset.worktree;
                if (confirm(`Delete worktree ${worktreeName}? This cannot be undone.`)) {
                    try {
                        await window.apiClient.deleteWorktree(projectName, worktreeName);
                        this.showSuccess(`Deleted worktree: ${worktreeName}`);
                        this.showSessionList(projectName); // Refresh
                    } catch (error) {
                        this.showError('Failed to delete worktree');
                    }
                }
            });
        });
    }

    // Show/hide navigation bar
    showNavigationBar() {
        if (this.isNavigationVisible) return;
        
        const navBar = document.createElement('div');
        navBar.id = 'navigation-bar';
        navBar.className = 'bg-gray-900 border-b border-gray-700 p-3';
        navBar.innerHTML = `
            <div class="flex items-center space-x-4">
                <button id="back-to-projects" class="text-green-400 hover:text-green-300">
                    ← Projects
                </button>
                ${window.appState.currentProject ? `
                    <span class="text-gray-400">|</span>
                    <button id="back-to-sessions" class="text-green-400 hover:text-green-300">
                        ${window.appState.currentProject}
                    </button>
                ` : ''}
                ${window.appState.sessionID ? `
                    <span class="text-gray-400">|</span>
                    <span class="text-gray-400">Session: ${window.appState.sessionID}</span>
                ` : ''}
            </div>
        `;
        
        document.body.insertBefore(navBar, document.body.firstChild);
        this.isNavigationVisible = true;
        
        // Setup navigation events
        document.getElementById('back-to-projects')?.addEventListener('click', () => {
            window.urlManager.navigateToProjectList();
        });
        
        document.getElementById('back-to-sessions')?.addEventListener('click', () => {
            window.urlManager.navigateToSessionList(window.appState.currentProject);
        });
    }

    hideNavigationBar() {
        const navBar = document.getElementById('navigation-bar');
        if (navBar) {
            navBar.remove();
            this.isNavigationVisible = false;
        }
    }

    // Modal functions
    showCreateProjectModal() {
        this.showModal('Create New Project', `
            <input type="text" id="project-name" placeholder="Project name" class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white">
        `, async () => {
            const projectName = document.getElementById('project-name').value.trim();
            if (projectName) {
                try {
                    await window.apiClient.createProject(projectName);
                    this.hideModal();
                    this.showProjectList(); // Refresh
                } catch (error) {
                    this.showError('Failed to create project');
                }
            }
        });
    }

    showCreateWorktreeModal(projectName) {
        this.showModal('Create New Worktree', `
            <input type="text" id="worktree-name" placeholder="Worktree name" class="w-full p-2 mb-3 bg-gray-700 border border-gray-600 rounded text-white">
            <input type="text" id="worktree-branch" placeholder="Branch name" class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white">
        `, async () => {
            const worktreeName = document.getElementById('worktree-name').value.trim();
            const branchName = document.getElementById('worktree-branch').value.trim();
            if (worktreeName && branchName) {
                try {
                    await window.apiClient.createWorktree(projectName, worktreeName, branchName);
                    this.hideModal();
                    this.showSessionList(projectName); // Refresh
                } catch (error) {
                    this.showError('Failed to create worktree');
                }
            }
        });
    }

    // Generic modal functions
    showModal(title, content, onConfirm) {
        const modal = document.createElement('div');
        modal.id = 'modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-gray-800 p-6 rounded-lg border border-gray-700 max-w-md w-full mx-4">
                <h3 class="text-xl font-semibold mb-4 text-green-400">${title}</h3>
                <div class="mb-4">${content}</div>
                <div class="flex justify-end space-x-2">
                    <button id="modal-cancel" class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded">
                        Cancel
                    </button>
                    <button id="modal-confirm" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded">
                        Create
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('modal-cancel').addEventListener('click', () => this.hideModal());
        document.getElementById('modal-confirm').addEventListener('click', onConfirm);
        
        // Focus first input
        const firstInput = modal.querySelector('input');
        if (firstInput) firstInput.focus();
    }

    hideModal() {
        const modal = document.getElementById('modal');
        if (modal) modal.remove();
    }

    // Notification functions
    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg text-white z-50 ${
            type === 'error' ? 'bg-red-600' : 
            type === 'success' ? 'bg-green-600' : 'bg-blue-600'
        }`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Create global instance
window.uiManager = new UIManager();