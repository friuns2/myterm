import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { ansiToHtml } from './utils';
import { currentProjectSignal, sessionIdSignal } from './state';

type SessionInfo = { id: string; projectName: string; status: string; created: string };
type ProjectInfo = { name: string; worktrees: Array<{ name: string; branch: string; relativePath: string }>} ;

const sessionsSignal = signal<SessionInfo[]>([]);
const projectsSignal = signal<ProjectInfo[]>([]);
const isLoadingSignal = signal(true);
const projectNameInputSignal = signal('');

export function Dashboard(props: { onConnect: () => void; onOpenSettings: () => void; onOpenWorktree: (project: string, worktree: string) => void }) {
  const load = async () => {
    try {
      isLoadingSignal.value = true;
      const [sessionsRes, projectsRes] = await Promise.all([
        fetch('/api/sessions'),
        fetch('/api/projects-with-worktrees')
      ]);
      sessionsSignal.value = await sessionsRes.json();
      projectsSignal.value = await projectsRes.json();
    } finally {
      isLoadingSignal.value = false;
    }
  };

  useEffect(() => { load(); }, []);

  const createProject = async () => {
    const name = projectNameInputSignal.value.trim();
    if (!name) return;
    const res = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    const result = await res.json();
    if (res.ok) {
      currentProjectSignal.value = result.name;
      props.onConnect();
    } else {
      alert(result.error || 'Failed to create project');
    }
  };

  const connectTo = (id: string, projectName?: string) => {
    sessionIdSignal.value = id;
    if (projectName) currentProjectSignal.value = projectName;
    props.onConnect();
  };

  const killSession = async (id: string) => {
    const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) load();
  };

  return (
    <div class="p-6 max-w-6xl mx-auto h-full flex flex-col overflow-y-auto">
      <div class="flex items-center justify-between mb-8">
        <h1 class="text-3xl font-bold">Shell Dashboard</h1>
        <div class="flex gap-2">
          <button class="btn btn-outline btn-sm" onClick={props.onOpenSettings}>
            <span class="text-lg">⚡</span> Shell Settings
          </button>
        </div>
      </div>

      <div class="mb-8">
        <h2 class="text-2xl font-semibold mb-4 flex items-center gap-2">
          <span class="text-primary">🖥️</span> All Active Sessions
        </h2>
        <div class="grid gap-3 mb-6">
          {sessionsSignal.value.length === 0 ? (
            <p class="text-center opacity-70 py-4">No active sessions</p>
          ) : (
            sessionsSignal.value.map(session => (
              <div class="card bg-base-200 shadow-lg">
                <div class="card-body p-4">
                  <div class="flex justify-between items-start">
                    <div class="cursor-pointer flex-1" onClick={() => connectTo(session.id, session.projectName)}>
                      <div class="flex items-center gap-2 mb-2">
                        <h3 class="font-semibold text-sm">{session.id}</h3>
                        <span class="badge badge-primary badge-sm">{session.projectName}</span>
                      </div>
                      <p class="text-xs opacity-70 line-clamp-2 break-all">Status: <span dangerouslySetInnerHTML={{ __html: ansiToHtml(session.status) }} /></p>
                      <p class="text-xs opacity-50">Created: {new Date(session.created).toLocaleString()}</p>
                    </div>
                    <div class="flex gap-2">
                      <button class="btn btn-primary btn-sm" onClick={() => connectTo(session.id, session.projectName)}>Connect</button>
                      <button class="btn btn-error btn-sm" onClick={() => killSession(session.id)}>Kill</button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div class="mb-8">
        <h2 class="text-2xl font-semibold mb-4 flex items-center gap-2">
          <span class="text-secondary">📁</span> All Projects & Worktrees
        </h2>
        <div class="mb-6">
          <div class="flex gap-2">
            <input type="text" placeholder="Enter project name" class="input input-bordered flex-1" value={projectNameInputSignal.value} onInput={(e) => (projectNameInputSignal.value = (e.currentTarget as HTMLInputElement).value)} />
            <button class="btn btn-primary" onClick={createProject}>Create Project</button>
          </div>
        </div>
        <div class="grid gap-4">
          {projectsSignal.value.length === 0 ? (
            <p class="text-center opacity-70 py-4">No projects found</p>
          ) : (
            projectsSignal.value.map(project => (
              <div class="card bg-base-300 shadow-lg">
                <div class="card-body p-4">
                  <div class="flex justify-between items-center mb-4">
                    <div class="cursor-pointer flex-1" onClick={() => { currentProjectSignal.value = project.name; props.onConnect(); }}>
                      <h3 class="text-lg font-bold">{project.name}</h3>
                    </div>
                    <div class="flex gap-2">
                      <button class="btn btn-primary btn-sm" onClick={() => { currentProjectSignal.value = project.name; props.onConnect(); }}>Open Project</button>
                    </div>
                  </div>

                  {project.worktrees.length > 0 ? (
                    <div class="mt-3">
                      <h4 class="text-sm font-semibold mb-2 opacity-80">Worktrees:</h4>
                      <div class="grid gap-2">
                        {project.worktrees.map(wt => (
                          <div class="bg-base-100 rounded-lg p-3 flex justify-between items-center">
                            <div class="cursor-pointer flex-1" onClick={() => props.onOpenWorktree(project.name, wt.name)}>
                              <div class="flex items-center gap-2">
                                <span class="text-success">🌿</span>
                                <span class="font-medium text-sm">{wt.name}</span>
                                <span class="badge badge-outline badge-xs">{wt.branch}</span>
                              </div>
                              <p class="text-xs opacity-60 mt-1">{wt.relativePath}</p>
                            </div>
                            <div class="flex gap-1">
                              <button class="btn btn-xs btn-primary" onClick={() => props.onOpenWorktree(project.name, wt.name)}>Open</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p class="text-xs opacity-50 mt-2">No worktrees</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


