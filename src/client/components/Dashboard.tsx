import { h } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { ansiToHtml } from '../utils';
import { showEnvironmentManager } from '../environment';
import { showAliasesManager } from '../aliases';
import { connectToSession, createNewProject, deleteProject, killSession, selectProject, showSessionsAndProjectsList } from '../projects';

type Session = { id: string; projectName: string; status: string; created: string };
type Worktree = { name: string; branch: string; relativePath: string };
type Project = { name: string; worktrees: Worktree[] };

const sessionsSig = signal<Session[]>([]);
const projectsSig = signal<Project[]>([]);
const loadingSig = signal<boolean>(true);
const projectNameSig = signal<string>('');

export function Dashboard() {

  const fetchData = async () => {
    loadingSig.value = true;
    try {
      const [sRes, pRes] = await Promise.all([fetch('/api/sessions'), fetch('/api/projects-with-worktrees')]);
      sessionsSig.value = await sRes.json();
      projectsSig.value = await pRes.json();
    } finally {
      loadingSig.value = false;
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const sessionsList = useMemo(() => {
    const sessions = sessionsSig.value;
    if (sessions.length === 0) return <p class="text-center opacity-70 py-4">No active sessions</p>;
    return sessions.map((s) => (
      <div class="card bg-base-200 shadow-lg hover:shadow-xl transition-shadow">
        <div class="card-body p-4">
          <div class="flex justify-between items-start">
            <div class="cursor-pointer flex-1" onClick={() => connectToSession(s.id, s.projectName)}>
              <div class="flex items-center gap-2 mb-2">
                <h3 class="font-semibold text-sm">{s.id}</h3>
                <span class="badge badge-primary badge-sm">{s.projectName}</span>
              </div>
              <p class="text-xs opacity-70 line-clamp-2 break-all">
                Status: <span dangerouslySetInnerHTML={{ __html: ansiToHtml(s.status) }} />
              </p>
              <p class="text-xs opacity-50">Created: {new Date(s.created).toLocaleString()}</p>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-primary btn-sm" onClick={() => connectToSession(s.id, s.projectName)}>Connect</button>
              <button class="btn btn-error btn-sm" onClick={() => void killSession(s.id)}>Kill</button>
            </div>
          </div>
        </div>
      </div>
    ));
  }, [sessionsSig.value]);

  const projectsList = useMemo(() => {
    const projects = projectsSig.value;
    if (projects.length === 0) return <p class="text-center opacity-70 py-4">No projects found</p>;
    return projects.map((p) => (
      <div class="card bg-base-300 shadow-lg">
        <div class="card-body p-4">
          <div class="flex justify-between items-center mb-4">
            <div class="cursor-pointer flex-1" onClick={() => selectProject(p.name)}>
              <h3 class="text-lg font-bold">{p.name}</h3>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-primary btn-sm" onClick={() => selectProject(p.name)}>Open Project</button>
              <button class="btn btn-secondary btn-sm" onClick={() => (window as any).createWorktreeModal?.(p.name)}>+ Worktree</button>
              <button class="btn btn-error btn-sm" onClick={() => void deleteProject(p.name)}>Delete</button>
            </div>
          </div>
          {p.worktrees.length > 0 ? (
            <div class="mt-3">
              <h4 class="text-sm font-semibold mb-2 opacity-80">Worktrees:</h4>
              <div class="grid gap-2">
                {p.worktrees.map((w) => (
                  <div class="bg-base-100 rounded-lg p-3 flex justify-between items-center">
                    <div class="cursor-pointer flex-1" onClick={() => (window as any).openWorktree?.(p.name, w.name)}>
                      <div class="flex items-center gap-2">
                        <span class="text-success">🌿</span>
                        <span class="font-medium text-sm">{w.name}</span>
                        <span class="badge badge-outline badge-xs">{w.branch}</span>
                      </div>
                      <p class="text-xs opacity-60 mt-1">{w.relativePath}</p>
                    </div>
                    <div class="flex gap-1">
                      <button class="btn btn-xs btn-primary" onClick={() => (window as any).openWorktree?.(p.name, w.name)}>Open</button>
                      <button class="btn btn-xs btn-success" onClick={() => (window as any).mergeWorktree?.(p.name, w.name)}>Merge</button>
                      <button class="btn btn-xs btn-error" onClick={() => (window as any).deleteWorktree?.(p.name, w.name)}>Delete</button>
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
    ));
  }, [projectsSig.value]);

  if (loadingSig.value) return <div class="p-6">Loading…</div>;

  return (
    <div class="p-6 max-w-6xl mx-auto h-full flex flex-col overflow-y-auto">
      <div class="flex items-center justify-between mb-8">
        <h1 class="text-3xl font-bold">Shell Dashboard</h1>
        <div class="flex gap-2">
          <button class="btn btn-outline btn-sm" onClick={() => showEnvironmentManager()}>
            <span class="text-lg">🌍</span> Environment Variables
          </button>
          <button class="btn btn-outline btn-sm" onClick={() => showAliasesManager()}>
            <span class="text-lg">⚡</span> Shell Aliases
          </button>
        </div>
      </div>

      <div class="mb-8">
        <h2 class="text-2xl font-semibold mb-4 flex items-center gap-2">
          <span class="text-primary">🖥️</span> All Active Sessions
        </h2>
        <div class="grid gap-3 mb-6">{sessionsList}</div>
      </div>

      <div class="mb-8">
        <h2 class="text-2xl font-semibold mb-4 flex items-center gap-2">
          <span class="text-secondary">📁</span> All Projects & Worktrees
        </h2>
        <div class="mb-6">
          <div class="flex gap-2">
            <input type="text" id="project-name" placeholder="Enter project name" class="input input-bordered flex-1" value={projectNameSig.value} onInput={(e: any) => (projectNameSig.value = e.currentTarget.value)} />
            <button class="btn btn-primary" onClick={() => void createNewProject()}>
              Create Project
            </button>
          </div>
        </div>
        <div class="grid gap-4">{projectsList}</div>
      </div>
    </div>
  );
}


