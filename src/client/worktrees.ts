import { state } from './state';

export function createWorktreeModal(projectName: string): void {
  const existing = document.getElementById('new-worktree-modal') as HTMLDialogElement | null;
  if (!existing) {
    const modalHTML = `
      <dialog id="new-worktree-modal" class="modal">
        <div class="modal-box">
          <h3 class="font-bold text-lg">Create New Worktree</h3>
          <div class="py-4">
            <div class="mb-4">
              <label class="label"><span class="label-text">Worktree Name</span></label>
              <input type="text" id="new-worktree-name" placeholder="Enter worktree name..." class="input input-bordered w-full" />
            </div>
            <div class="mb-4">
              <label class="label"><span class="label-text">Branch Name (optional)</span></label>
              <input type="text" id="new-worktree-branch" placeholder="Enter new branch name..." class="input input-bordered w-full" />
              <div class="label"><span class="label-text-alt">Leave empty to checkout existing branch</span></div>
            </div>
          </div>
          <div class="modal-action">
            <button id="create-worktree-btn" class="btn btn-secondary">Create Worktree</button>
            <button id="cancel-worktree-btn" class="btn">Cancel</button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop"><button>close</button></form>
      </dialog>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.getElementById('create-worktree-btn')?.addEventListener('click', () => handleWorktreeCreation(projectName));
    document.getElementById('cancel-worktree-btn')?.addEventListener('click', () => (document.getElementById('new-worktree-modal') as HTMLDialogElement | null)?.close());
    const worktreeNameInput = document.getElementById('new-worktree-name');
    const worktreeBranchInput = document.getElementById('new-worktree-branch');
    worktreeNameInput?.addEventListener('keypress', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') handleWorktreeCreation(projectName);
    });
    worktreeBranchInput?.addEventListener('keypress', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') handleWorktreeCreation(projectName);
    });
  }
  (document.getElementById('new-worktree-name') as HTMLInputElement | null)!.value = '';
  (document.getElementById('new-worktree-branch') as HTMLInputElement | null)!.value = '';
  (document.getElementById('new-worktree-modal') as HTMLDialogElement | null)?.showModal();
  (document.getElementById('new-worktree-name') as HTMLInputElement | null)?.focus();
}

export async function handleWorktreeCreation(projectName: string): Promise<void> {
  const nameInput = document.getElementById('new-worktree-name') as HTMLInputElement | null;
  const branchInput = document.getElementById('new-worktree-branch') as HTMLInputElement | null;
  const name = (nameInput?.value || '').trim();
  const branch = (branchInput?.value || '').trim();
  if (!name) {
    await (window as any).Swal.fire({ title: 'Error', text: 'Please enter a worktree name', icon: 'error' });
    return;
  }
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}/worktrees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, branch: branch || undefined })
    });
    const result = await response.json();
    if (response.ok) {
      (document.getElementById('new-worktree-modal') as HTMLDialogElement | null)?.close();
      (window as any).showSessionsAndProjectsList?.();
    } else {
      await (window as any).Swal.fire({ title: 'Error', text: result.error || 'Failed to create worktree', icon: 'error' });
    }
  } catch (error) {
    console.error('Error creating worktree:', error);
    await (window as any).Swal.fire({ title: 'Error', text: 'Error creating worktree', icon: 'error' });
  }
}

export function openWorktree(projectName: string, worktreeName: string): void {
  state.sessionID = null;
  state.currentProject = `${projectName}/worktrees/${worktreeName}`;
  (window as any).initializeTerminal?.();
}

export async function mergeWorktree(projectName: string, worktreeName: string): Promise<void> {
  const { value: targetBranch } = await (window as any).Swal.fire({
    title: 'Enter target branch',
    input: 'text',
    inputLabel: 'Target branch to merge into',
    inputValue: 'main',
    showCancelButton: true,
    inputValidator: (value: string) => (!value ? 'You need to enter a branch name!' : undefined),
  });
  if (!targetBranch) return;
  const confirmResult = await (window as any).Swal.fire({
    title: 'Confirm merge',
    text: `Are you sure you want to merge worktree "${worktreeName}" into "${targetBranch}"? This will also delete the worktree.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Yes, merge it!'
  });
  if (!confirmResult.isConfirmed) return;
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}/worktrees/${encodeURIComponent(worktreeName)}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetBranch: targetBranch || 'main' })
    });
    const result = await response.json();
    if (response.ok) {
      await (window as any).Swal.fire({ title: 'Success!', text: result.message || 'Worktree merged successfully', icon: 'success' });
      (window as any).showSessionsAndProjectsList?.();
    } else {
      await (window as any).Swal.fire({ title: 'Error', text: result.error || 'Failed to merge worktree', icon: 'error' });
    }
  } catch (error) {
    console.error('Error merging worktree:', error);
    await (window as any).Swal.fire({ title: 'Error', text: 'Error merging worktree', icon: 'error' });
  }
}

export async function deleteWorktree(projectName: string, worktreeName: string): Promise<void> {
  const confirmResult = await (window as any).Swal.fire({
    title: 'Delete Worktree',
    text: `Are you sure you want to delete worktree "${worktreeName}"? This action cannot be undone.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Yes, delete it!',
    cancelButtonText: 'Cancel'
  });
  if (!confirmResult.isConfirmed) return;
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}/worktrees/${encodeURIComponent(worktreeName)}`, { method: 'DELETE' });
    const result = await response.json();
    if (response.ok) {
      await (window as any).Swal.fire({ title: 'Success!', text: result.message || 'Worktree deleted successfully', icon: 'success' });
      (window as any).showSessionsAndProjectsList?.();
    } else {
      await (window as any).Swal.fire({ title: 'Error', text: result.error || 'Failed to delete worktree', icon: 'error' });
    }
  } catch (error) {
    console.error('Error deleting worktree:', error);
    await (window as any).Swal.fire({ title: 'Error', text: 'Error deleting worktree', icon: 'error' });
  }
}


