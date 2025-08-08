import { ansiToHtml } from './utils';
import { state } from './state';
import { cleanupTerminal, initializeTerminal } from './terminal';

export function goBackToSessionList(): void {
  if (typeof (window as any).cleanupTerminal === 'function') {
    (window as any).cleanupTerminal();
  }
  state.sessionID = null;
  state.currentProject = null;
  if (typeof (window as any).updateURLWithoutSession === 'function') {
    (window as any).updateURLWithoutSession();
  }
  showSessionsAndProjectsList();
}

export function goBackToProjectList(): void {
  if (typeof (window as any).cleanupTerminal === 'function') {
    (window as any).cleanupTerminal();
  }
  state.sessionID = null;
  state.currentProject = null;
  showSessionsAndProjectsList();
}

export async function showSessionsAndProjectsList(): Promise<void> {
  const hideNavigationBar = (window as any).hideNavigationBar as (() => void) | undefined;
  if (hideNavigationBar) hideNavigationBar();

  try {
    const [sessionsResponse, projectsResponse] = await Promise.all([
      fetch('/api/sessions'),
      fetch('/api/projects-with-worktrees')
    ]);
    const allSessions = await sessionsResponse.json();
    const projectsWithWorktrees = await projectsResponse.json();

    const terminalContainer = document.getElementById('terminal-container');
    if (!terminalContainer) return;
    terminalContainer.innerHTML = `
      <div class="p-6 max-w-6xl mx-auto h-full flex flex-col overflow-y-auto">
        <div class="flex items-center justify-between mb-8">
          <h1 class="text-3xl font-bold">Shell Dashboard</h1>
          <div class="flex gap-2">
            <button class="btn btn-outline btn-sm" id="btn-env"> <span class="text-lg">🌍</span> Environment Variables </button>
            <button class="btn btn-outline btn-sm" id="btn-aliases"> <span class="text-lg">⚡</span> Shell Aliases </button>
          </div>
        </div>
        <div class="mb-8">
          <h2 class="text-2xl font-semibold mb-4 flex items-center gap-2">
            <span class="text-primary">🖥️</span> All Active Sessions
          </h2>
          <div class="grid gap-3 mb-6">
            ${
              allSessions.length === 0
                ? '<p class="text-center opacity-70 py-4">No active sessions</p>'
                : allSessions
                    .map((session: any) => `
              <div class="card bg-base-200 shadow-lg hover:shadow-xl transition-shadow">
                <div class="card-body p-4">
                  <div class="flex justify-between items-start">
                    <div class="cursor-pointer flex-1" data-connect-session="${session.id}" data-project="${session.projectName}">
                      <div class="flex items-center gap-2 mb-2">
                        <h3 class="font-semibold text-sm">${session.id}</h3>
                        <span class="badge badge-primary badge-sm">${session.projectName}</span>
                      </div>
                      <p class="text-xs opacity-70 line-clamp-2 break-all">Status: <span>${ansiToHtml(session.status)}</span></p>
                      <p class="text-xs opacity-50">Created: ${new Date(session.created).toLocaleString()}</p>
                    </div>
                    <div class="flex gap-2">
                      <button class="btn btn-primary btn-sm" data-connect-session="${session.id}" data-project="${session.projectName}">Connect</button>
                      <button class="btn btn-error btn-sm" data-kill-session="${session.id}">Kill</button>
                    </div>
                  </div>
                </div>
              </div>`)
                    .join('')
            }
          </div>
        </div>
        <div class="mb-8">
          <h2 class="text-2xl font-semibold mb-4 flex items-center gap-2">
            <span class="text-secondary">📁</span> All Projects & Worktrees
          </h2>
          <div class="mb-6">
            <div class="flex gap-2">
              <input type="text" id="project-name" placeholder="Enter project name" class="input input-bordered flex-1">
              <button class="btn btn-primary" id="btn-create-project">Create Project</button>
            </div>
          </div>
          <div class="grid gap-4">
            ${
              projectsWithWorktrees.length === 0
                ? '<p class="text-center opacity-70 py-4">No projects found</p>'
                : projectsWithWorktrees
                    .map((project: any) => `
              <div class="card bg-base-300 shadow-lg">
                <div class="card-body p-4">
                  <div class="flex justify-between items-center mb-4">
                    <div class="cursor-pointer flex-1" data-open-project="${project.name}">
                      <h3 class="text-lg font-bold">${project.name}</h3>
                    </div>
                    <div class="flex gap-2">
                      <button class="btn btn-primary btn-sm" data-open-project="${project.name}">Open Project</button>
                      <button class="btn btn-secondary btn-sm" data-open-worktree-modal="${project.name}">+ Worktree</button>
                      <button class="btn btn-error btn-sm" data-delete-project="${project.name}">Delete</button>
                    </div>
                  </div>
                  ${
                    project.worktrees.length > 0
                      ? `
                    <div class="mt-3">
                      <h4 class="text-sm font-semibold mb-2 opacity-80">Worktrees:</h4>
                      <div class="grid gap-2">
                        ${project.worktrees
                          .map(
                            (worktree: any) => `
                          <div class="bg-base-100 rounded-lg p-3 flex justify-between items-center">
                            <div class="cursor-pointer flex-1" data-open-worktree='{"project":"${project.name}","worktree":"${worktree.name}"}'>
                              <div class="flex items-center gap-2">
                                <span class="text-success">🌿</span>
                                <span class="font-medium text-sm">${worktree.name}</span>
                                <span class="badge badge-outline badge-xs">${worktree.branch}</span>
                              </div>
                              <p class="text-xs opacity-60 mt-1">${worktree.relativePath}</p>
                            </div>
                            <div class="flex gap-1">
                              <button class="btn btn-xs btn-primary" data-open-worktree='{"project":"${project.name}","worktree":"${worktree.name}"}'>Open</button>
                              <button class="btn btn-xs btn-success" data-merge-worktree='{"project":"${project.name}","worktree":"${worktree.name}"}'>Merge</button>
                              <button class="btn btn-xs btn-error" data-delete-worktree='{"project":"${project.name}","worktree":"${worktree.name}"}'>Delete</button>
                            </div>
                          </div>`
                          )
                          .join('')}
                      </div>
                    </div>`
                      : '<p class="text-xs opacity-50 mt-2">No worktrees</p>'
                  }
                </div>
              </div>`)
                    .join('')
            }
          </div>
        </div>
      </div>
    `;

    // Attach event handlers after render
    const envBtn = document.getElementById('btn-env');
    envBtn?.addEventListener('click', () => (window as any).showEnvironmentManager?.());
    const aliasBtn = document.getElementById('btn-aliases');
    aliasBtn?.addEventListener('click', () => (window as any).showAliasesManager?.());

    document.querySelectorAll('[data-connect-session]')?.forEach((el) => {
      el.addEventListener('click', () => {
        const id = (el as HTMLElement).getAttribute('data-connect-session')!;
        const proj = (el as HTMLElement).getAttribute('data-project');
        connectToSession(id, proj);
      });
    });

    document.querySelectorAll('[data-kill-session]')?.forEach((el) => {
      el.addEventListener('click', () => {
        const id = (el as HTMLElement).getAttribute('data-kill-session')!;
        void killSession(id);
      });
    });

    document.getElementById('btn-create-project')?.addEventListener('click', () => {
      void createNewProject();
    });

    document.querySelectorAll('[data-open-project]')?.forEach((el) => {
      el.addEventListener('click', () => {
        selectProject((el as HTMLElement).getAttribute('data-open-project')!);
      });
    });

    document.querySelectorAll('[data-open-worktree-modal]')?.forEach((el) => {
      el.addEventListener('click', () => {
        const projectName = (el as HTMLElement).getAttribute('data-open-worktree-modal')!;
        (window as any).createWorktreeModal?.(projectName);
      });
    });

    document.querySelectorAll('[data-delete-project]')?.forEach((el) => {
      el.addEventListener('click', () => {
        void deleteProject((el as HTMLElement).getAttribute('data-delete-project')!);
      });
    });

    document.querySelectorAll('[data-open-worktree]')?.forEach((el) => {
      el.addEventListener('click', () => {
        const payload = (el as HTMLElement).getAttribute('data-open-worktree');
        if (!payload) return;
        const { project, worktree } = JSON.parse(payload);
        (window as any).openWorktree?.(project, worktree);
      });
    });

    document.querySelectorAll('[data-merge-worktree]')?.forEach((el) => {
      el.addEventListener('click', () => {
        const payload = (el as HTMLElement).getAttribute('data-merge-worktree');
        if (!payload) return;
        const { project, worktree } = JSON.parse(payload);
        (window as any).mergeWorktree?.(project, worktree);
      });
    });

    document.querySelectorAll('[data-delete-worktree]')?.forEach((el) => {
      el.addEventListener('click', () => {
        const payload = (el as HTMLElement).getAttribute('data-delete-worktree');
        if (!payload) return;
        const { project, worktree } = JSON.parse(payload);
        (window as any).deleteWorktree?.(project, worktree);
      });
    });
  } catch (error) {
    console.error('Failed to load sessions and projects:', error);
    const terminalContainer = document.getElementById('terminal-container');
    if (terminalContainer) {
      terminalContainer.innerHTML = '<div class="p-6 text-center text-error">Error loading sessions and projects</div>';
    }
  }
}

export async function createNewProject(): Promise<void> {
  const projectNameInput = document.getElementById('project-name') as HTMLInputElement | null;
  const projectName = (projectNameInput?.value || '').trim();
  if (!projectName) {
    await (window as any).Swal.fire({ title: 'Error', text: 'Please enter a project name', icon: 'error' });
    return;
  }
  try {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: projectName })
    });
    const result = await response.json();
    if (response.ok) {
      selectProject(result.name);
    } else {
      await (window as any).Swal.fire({ title: 'Error', text: result.error || 'Failed to create project', icon: 'error' });
    }
  } catch (error) {
    console.error('Error creating project:', error);
    await (window as any).Swal.fire({ title: 'Error', text: 'Error creating project', icon: 'error' });
  }
}

export async function deleteProject(projectName: string): Promise<void> {
  const result = await (window as any).Swal.fire({
    title: 'Delete Project?',
    text: `Are you sure you want to delete the project "${projectName}"? This action cannot be undone.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Yes, delete it!'
  });
  if (!result.isConfirmed) return;
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}`, { method: 'DELETE' });
    const deleteResult = await response.json();
    if (response.ok) {
      await (window as any).Swal.fire({ title: 'Deleted!', text: deleteResult.message || 'Project deleted successfully', icon: 'success' });
      showSessionsAndProjectsList();
    } else {
      await (window as any).Swal.fire({ title: 'Error', text: deleteResult.error || 'Failed to delete project', icon: 'error' });
    }
  } catch (error) {
    console.error('Error deleting project:', error);
    await (window as any).Swal.fire({ title: 'Error', text: 'Error deleting project', icon: 'error' });
  }
}

export function selectProject(projectName: string): void {
  state.currentProject = projectName;
  state.sessionID = null;
  initializeTerminal();
}

export function connectToSession(sessionId: string, projectName?: string | null): void {
  if (typeof cleanupTerminal === 'function') cleanupTerminal();
  state.sessionID = sessionId;
  state.currentProject = projectName ?? state.currentProject;
  if (typeof (window as any).updateURLWithSession === 'function')
    (window as any).updateURLWithSession(sessionId, state.currentProject);
  initializeTerminal();
}

export async function killSession(sessionId: string): Promise<void> {
  try {
    const response = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
    const result = await response.json();
    if (result.success) {
      showSessionsAndProjectsList();
    } else {
      await (window as any).Swal.fire({ title: 'Error', text: 'Failed to kill session: ' + result.message, icon: 'error' });
    }
  } catch (error) {
    console.error('Error killing session:', error);
    await (window as any).Swal.fire({ title: 'Error', text: 'Error killing session', icon: 'error' });
  }
}


