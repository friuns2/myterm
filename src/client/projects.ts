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
  const container = document.getElementById('terminal-container');
  if (!container) return;
  container.innerHTML = '';
  (window as any).render?.((window as any).h?.((window as any).Dashboard), container);
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


