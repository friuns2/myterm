import { ansiToHtml, stripAnsiCodes } from './utils';
import { state } from './state';
import { cleanupTerminal, initializeTerminal } from './terminal';
import { render, html } from 'uhtml';

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

    const SessionCard = (session: any) => html`
      <div class="card bg-base-200 shadow-lg hover:shadow-xl transition-shadow">
        <div class="card-body p-4">
          <div class="flex justify-between items-start">
            <div class="cursor-pointer flex-1" onclick=${() => connectToSession(session.id, session.projectName)}>
              <div class="flex items-center gap-2 mb-2">
                <h3 class="font-semibold text-sm">${session.id}</h3>
                <span class="badge badge-primary badge-sm">${session.projectName}</span>
              </div>
              <p class="text-xs opacity-70 line-clamp-2 break-all">Status: <span>${stripAnsiCodes(session.status)}</span></p>
              <p class="text-xs opacity-50">Created: ${new Date(session.created).toLocaleString()}</p>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-primary btn-sm" onclick=${() => connectToSession(session.id, session.projectName)}>Connect</button>
              <button class="btn btn-error btn-sm" onclick=${() => killSession(session.id)}>Kill</button>
            </div>
          </div>
        </div>
      </div>`;

    const WorktreeItem = (projectName: string, worktree: any) => html`
      <div class="bg-base-100 rounded-lg p-3 flex justify-between items-center">
        <div class="cursor-pointer flex-1" onclick=${() => (window as any).openWorktree?.(projectName, worktree.name)}>
          <div class="flex items-center gap-2">
            <span class="text-success">🌿</span>
            <span class="font-medium text-sm">${worktree.name}</span>
            <span class="badge badge-outline badge-xs">${worktree.branch}</span>
          </div>
          <p class="text-xs opacity-60 mt-1">${worktree.relativePath}</p>
        </div>
        <div class="flex gap-1">
          <button class="btn btn-xs btn-primary" onclick=${() => (window as any).openWorktree?.(projectName, worktree.name)}>Open</button>
          <button class="btn btn-xs btn-success" onclick=${() => (window as any).mergeWorktree?.(projectName, worktree.name)}>Merge</button>
          <button class="btn btn-xs btn-error" onclick=${() => (window as any).deleteWorktree?.(projectName, worktree.name)}>Delete</button>
        </div>
      </div>`;

    const ProjectCard = (project: any) => html`
      <div class="card bg-base-300 shadow-lg">
        <div class="card-body p-4">
          <div class="flex justify-between items-center mb-4">
            <div class="cursor-pointer flex-1" onclick=${() => selectProject(project.name)}>
              <h3 class="text-lg font-bold">${project.name}</h3>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-primary btn-sm" onclick=${() => selectProject(project.name)}>Open Project</button>
              <button class="btn btn-secondary btn-sm" onclick=${() => (window as any).createWorktreeModal?.(project.name)}>+ Worktree</button>
              <button class="btn btn-error btn-sm" onclick=${() => deleteProject(project.name)}>Delete</button>
            </div>
          </div>
          ${project.worktrees.length > 0
            ? html`<div class="mt-3">
                <h4 class="text-sm font-semibold mb-2 opacity-80">Worktrees:</h4>
                <div class="grid gap-2">
                  ${project.worktrees.map((wt: any) => WorktreeItem(project.name, wt))}
                </div>
               </div>`
            : html`<p class="text-xs opacity-50 mt-2">No worktrees</p>`}
        </div>
      </div>`;

    render(
      terminalContainer,
      html`<div class="p-6 max-w-6xl mx-auto h-full flex flex-col overflow-y-auto">
        <div class="flex items-center justify-between mb-8">
          <h1 class="text-3xl font-bold">Shell Dashboard</h1>
          <div class="flex gap-2">
            <button class="btn btn-outline btn-sm" onclick=${() => (window as any).showEnvironmentManager?.()}><span class="text-lg">🌍</span> Environment Variables</button>
            <button class="btn btn-outline btn-sm" onclick=${() => (window as any).showAliasesManager?.()}><span class="text-lg">⚡</span> Shell Aliases</button>
          </div>
        </div>
        <div class="mb-8">
          <h2 class="text-2xl font-semibold mb-4 flex items-center gap-2"><span class="text-primary">🖥️</span> All Active Sessions</h2>
          <div class="grid gap-3 mb-6">
            ${allSessions.length === 0 ? html`<p class="text-center opacity-70 py-4">No active sessions</p>` : allSessions.map((s: any) => SessionCard(s))}
          </div>
        </div>
        <div class="mb-8">
          <h2 class="text-2xl font-semibold mb-4 flex items-center gap-2"><span class="text-secondary">📁</span> All Projects & Worktrees</h2>
          <div class="mb-6">
            <div class="flex gap-2">
              <input type="text" id="project-name" placeholder="Enter project name" class="input input-bordered flex-1">
              <button class="btn btn-primary" onclick=${() => createNewProject()}>Create Project</button>
            </div>
          </div>
          <div class="grid gap-4">
            ${projectsWithWorktrees.length === 0 ? html`<p class="text-center opacity-70 py-4">No projects found</p>` : projectsWithWorktrees.map((p: any) => ProjectCard(p))}
          </div>
        </div>
      </div>`
    );
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


