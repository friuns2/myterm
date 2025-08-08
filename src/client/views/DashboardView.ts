import { html } from 'uhtml';
import { ansiToHtml } from '../utils';

type SessionInfo = { id: string; projectName: string; status: string; created: string };
type Worktree = { name: string; branch: string; relativePath: string };
type Project = { name: string; worktrees: Worktree[] };

type Props = {
  onOpenEnvironment: () => void;
  onOpenAliases: () => void;
  onOpenProject: (projectName: string) => void;
  onConnectSession: (sessionId: string, projectName?: string) => void;
};

export function renderDashboardView(props: Props) {
  return html`<div class="p-6 max-w-6xl mx-auto h-full flex flex-col overflow-y-auto">
    <div class="flex items-center justify-between mb-8">
      <h1 class="text-3xl font-bold">Shell Dashboard</h1>
      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm" onclick=${props.onOpenEnvironment}>🌍 Environment Variables</button>
        <button class="btn btn-outline btn-sm" onclick=${props.onOpenAliases}>⚡ Shell Aliases</button>
      </div>
    </div>

    ${SessionsSection(props)}
    ${ProjectsSection(props)}
  </div>`;
}

function SessionsSection(props: Props) {
  const sessionsPromise: Promise<SessionInfo[]> = fetch('/api/sessions').then(r => r.json());
  return html`<div class="mb-8">
    <h2 class="text-2xl font-semibold mb-4 flex items-center gap-2">🖥️ All Active Sessions</h2>
    ${AsyncBlock(sessionsPromise, (allSessions) => html`<div class="grid gap-3 mb-6">
      ${allSessions.length === 0 ? html`<p class="text-center opacity-70 py-4">No active sessions</p>` : allSessions.map(session => html`<div class="card bg-base-200 shadow-lg hover:shadow-xl transition-shadow">
        <div class="card-body p-4">
          <div class="flex justify-between items-start">
            <div class="cursor-pointer flex-1" onclick=${() => props.onConnectSession(session.id, session.projectName)}>
              <div class="flex items-center gap-2 mb-2">
                <h3 class="font-semibold text-sm">${session.id}</h3>
                <span class="badge badge-primary badge-sm">${session.projectName}</span>
              </div>
              <p class="text-xs opacity-70 line-clamp-2 break-all">Status: ${html([ansiToHtml(session.status)])}</p>
              <p class="text-xs opacity-50">Created: ${new Date(session.created).toLocaleString()}</p>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-primary btn-sm" onclick=${() => props.onConnectSession(session.id, session.projectName)}>Connect</button>
              <button class="btn btn-error btn-sm" onclick=${() => killSession(session.id, props)}>Kill</button>
            </div>
          </div>
        </div>
      </div>`)}
    </div>`)}
  </div>`;
}

async function killSession(sessionId: string, props: Props) {
  const response = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
  const result = await response.json();
  if (result.success) {
    // re-render by doing nothing (parent will re-fetch sessions on rerender)
    // In a more advanced setup, we would cause a state update.
    window.dispatchEvent(new Event('popstate')); // trigger rerender pipeline
  } else {
    alert('Failed to kill session: ' + result.message);
  }
}

function ProjectsSection(props: Props) {
  const projectsPromise: Promise<Project[]> = fetch('/api/projects-with-worktrees').then(r => r.json());

  let projectName = '';

  const onInput = (e: Event) => {
    projectName = (e.target as HTMLInputElement).value;
  };

  const createProject = async () => {
    const name = projectName.trim();
    if (!name) return alert('Please enter a project name');
    const response = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    const result = await response.json();
    if (response.ok) {
      props.onOpenProject(result.name);
    } else {
      alert(result.error || 'Failed to create project');
    }
  };

  return html`<div class="mb-8">
    <h2 class="text-2xl font-semibold mb-4 flex items-center gap-2">📁 All Projects & Worktrees</h2>
    <div class="mb-6">
      <div class="flex gap-2">
        <input type="text" placeholder="Enter project name" class="input input-bordered flex-1" oninput=${onInput} />
        <button class="btn btn-primary" onclick=${createProject}>Create Project</button>
      </div>
    </div>
    ${AsyncBlock(projectsPromise, (projects) => html`<div class="grid gap-4">
      ${projects.length === 0 ? html`<p class="text-center opacity-70 py-4">No projects found</p>` : projects.map(project => html`<div class="card bg-base-300 shadow-lg">
        <div class="card-body p-4">
          <div class="flex justify-between items-center mb-4">
            <div class="cursor-pointer flex-1" onclick=${() => props.onOpenProject(project.name)}>
              <h3 class="text-lg font-bold">${project.name}</h3>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-primary btn-sm" onclick=${() => props.onOpenProject(project.name)}>Open Project</button>
              <button class="btn btn-secondary btn-sm" onclick=${() => createWorktreeModal(project.name)}>+ Worktree</button>
              <button class="btn btn-error btn-sm" onclick=${() => deleteProject(project.name)}>Delete</button>
            </div>
          </div>
          ${project.worktrees.length > 0 ? html`<div class="mt-3">
            <h4 class="text-sm font-semibold mb-2 opacity-80">Worktrees:</h4>
            <div class="grid gap-2">
              ${project.worktrees.map(worktree => html`<div class="bg-base-100 rounded-lg p-3 flex justify-between items-center">
                <div class="cursor-pointer flex-1" onclick=${() => openWorktree(props, project.name, worktree.name)}>
                  <div class="flex items-center gap-2">
                    <span class="text-success">🌿</span>
                    <span class="font-medium text-sm">${worktree.name}</span>
                    <span class="badge badge-outline badge-xs">${worktree.branch}</span>
                  </div>
                  <p class="text-xs opacity-60 mt-1">${worktree.relativePath}</p>
                </div>
                <div class="flex gap-1">
                  <button class="btn btn-xs btn-primary" onclick=${() => openWorktree(props, project.name, worktree.name)}>Open</button>
                  <button class="btn btn-xs btn-success" onclick=${() => mergeWorktree(project.name, worktree.name)}>Merge</button>
                  <button class="btn btn-xs btn-error" onclick=${() => deleteWorktree(project.name, worktree.name)}>Delete</button>
                </div>
              </div>`)}
            </div>
          </div>` : html`<p class="text-xs opacity-50 mt-2">No worktrees</p>`}
        </div>
      </div>`)}
    </div>`)}
  </div>`;
}

function AsyncBlock<T>(promise: Promise<T>, view: (v: T) => any) {
  let resolved: T | null = null;
  let error: Error | null = null;
  promise.then(v => { resolved = v; rerender(); }).catch(e => { error = e; rerender(); });

  const rerender = () => {
    // Force a reflow by dispatching an event; main.ts re-renders on popstate already
    window.dispatchEvent(new Event('popstate'));
  };

  if (error) return html`<div class="text-error">${String(error)}</div>`;
  if (resolved) return view(resolved);
  return html`<div class="opacity-70">Loading...</div>`;
}

async function deleteProject(projectName: string) {
  if (!confirm(`Delete project "${projectName}"?`)) return;
  const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}`, { method: 'DELETE' });
  const result = await response.json();
  if (!response.ok) alert(result.error || 'Failed to delete project');
  window.dispatchEvent(new Event('popstate'));
}

function openWorktree(props: Props, projectName: string, worktreeName: string) {
  props.onOpenProject(`${projectName}/worktrees/${worktreeName}`);
}

async function createWorktreeModal(projectName: string) {
  const name = prompt('Enter worktree name');
  if (!name) return;
  const branch = prompt('Enter new branch name (optional)') || undefined;
  const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}/worktrees`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, branch })
  });
  const result = await response.json();
  if (!response.ok) alert(result.error || 'Failed to create worktree');
  window.dispatchEvent(new Event('popstate'));
}

async function mergeWorktree(projectName: string, worktreeName: string) {
  const targetBranch = prompt('Enter target branch to merge into', 'main');
  if (!targetBranch) return;
  const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}/worktrees/${encodeURIComponent(worktreeName)}/merge`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetBranch })
  });
  const result = await response.json();
  if (!response.ok) alert(result.error || 'Failed to merge worktree');
  window.dispatchEvent(new Event('popstate'));
}

async function deleteWorktree(projectName: string, worktreeName: string) {
  if (!confirm(`Delete worktree "${worktreeName}"?`)) return;
  const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}/worktrees/${encodeURIComponent(worktreeName)}`, { method: 'DELETE' });
  const result = await response.json();
  if (!response.ok) alert(result.error || 'Failed to delete worktree');
  window.dispatchEvent(new Event('popstate'));
}


