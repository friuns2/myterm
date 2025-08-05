// Worktrees management module

import { showSessionsAndProjectsList } from './sessions.js';
import { setCurrentProject, updateURLWithProject } from './websocket.js';

/**
 * Create worktree modal
 * @param {string} projectName - Name of the project
 */
export function createWorktreeModal(projectName) {
    let modal = document.getElementById('new-worktree-modal');
    
    if (!modal) {
        // Create the modal if it doesn't exist
        const modalHTML = `
            <dialog id="new-worktree-modal" class="modal">
                <div class="modal-box">
                    <h3 class="font-bold text-lg">Create New Worktree</h3>
                    <div class="py-4">
                        <div class="mb-4">
                            <label class="label">
                                <span class="label-text">Worktree Name</span>
                            </label>
                            <input type="text" id="new-worktree-name" placeholder="Enter worktree name..." 
                                   class="input input-bordered w-full" />
                        </div>
                        <div class="mb-4">
                            <label class="label">
                                <span class="label-text">Branch Name (optional)</span>
                            </label>
                            <input type="text" id="new-worktree-branch" placeholder="Enter new branch name..." 
                                   class="input input-bordered w-full" />
                            <div class="label">
                                <span class="label-text-alt">Leave empty to checkout existing branch</span>
                            </div>
                        </div>
                    </div>
                    <div class="modal-action">
                        <button id="create-worktree-btn" class="btn btn-secondary">Create Worktree</button>
                        <button id="cancel-worktree-btn" class="btn">Cancel</button>
                    </div>
                </div>
                <form method="dialog" class="modal-backdrop">
                    <button>close</button>
                </form>
            </dialog>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add event listeners for the new modal
        document.getElementById('create-worktree-btn').addEventListener('click', () => handleWorktreeCreation(projectName));
        document.getElementById('cancel-worktree-btn').addEventListener('click', () => {
            document.getElementById('new-worktree-modal').close();
        });
        
        setupWorktreeModalKeyListeners(projectName);
        
        modal = document.getElementById('new-worktree-modal');
    }
    
    // Clear inputs and show modal
    const nameInput = document.getElementById('new-worktree-name');
    const branchInput = document.getElementById('new-worktree-branch');
    
    if (nameInput) nameInput.value = '';
    if (branchInput) branchInput.value = '';
    
    modal.showModal();
    if (nameInput) nameInput.focus();
}

/**
 * Setup keyboard listeners for worktree modal
 * @param {string} projectName - Project name
 */
function setupWorktreeModalKeyListeners(projectName) {
    const worktreeNameInput = document.getElementById('new-worktree-name');
    const worktreeBranchInput = document.getElementById('new-worktree-branch');
    
    if (worktreeNameInput) {
        worktreeNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleWorktreeCreation(projectName);
            }
        });
    }
    
    if (worktreeBranchInput) {
        worktreeBranchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleWorktreeCreation(projectName);
            }
        });
    }
}

/**
 * Handle worktree creation
 * @param {string} projectName - Project name
 */
export async function handleWorktreeCreation(projectName) {
    const nameInput = document.getElementById('new-worktree-name');
    const branchInput = document.getElementById('new-worktree-branch');
    
    if (!nameInput) {
        console.error('Worktree name input not found');
        return;
    }
    
    const name = nameInput.value.trim();
    const branch = branchInput ? branchInput.value.trim() : '';
    
    if (!name) {
        await Swal.fire({
            title: 'Error',
            text: 'Please enter a worktree name',
            icon: 'error'
        });
        return;
    }
    
    try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}/worktrees`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, branch: branch || undefined })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            const modal = document.getElementById('new-worktree-modal');
            if (modal) {
                modal.close();
            }
            
            await Swal.fire({
                title: 'Success!',
                text: result.message || 'Worktree created successfully',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
            
            // Go back to dashboard
            showSessionsAndProjectsList();
        } else {
            await Swal.fire({
                title: 'Error',
                text: result.error || 'Failed to create worktree',
                icon: 'error'
            });
        }
    } catch (error) {
        console.error('Error creating worktree:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Error creating worktree: ' + error.message,
            icon: 'error'
        });
    }
}

/**
 * Open worktree in terminal
 * @param {string} projectName - Project name
 * @param {string} worktreeName - Worktree name
 */
export function openWorktree(projectName, worktreeName) {
    // Open a new terminal session in the worktree directory
    const worktreeProject = `${projectName}/worktrees/${worktreeName}`;
    setCurrentProject(worktreeProject);
    updateURLWithProject(worktreeProject);
    
    // Import and initialize terminal here to avoid circular dependency
    import('./main.js').then(main => {
        main.initializeTerminal();
    });
}

/**
 * Merge worktree
 * @param {string} projectName - Project name
 * @param {string} worktreeName - Worktree name
 */
export async function mergeWorktree(projectName, worktreeName) {
    const { value: targetBranch } = await Swal.fire({
        title: 'Enter target branch',
        input: 'text',
        inputLabel: 'Target branch to merge into',
        inputValue: 'main',
        showCancelButton: true,
        confirmButtonText: 'Continue',
        inputValidator: (value) => {
            if (!value || !value.trim()) {
                return 'You need to enter a branch name!';
            }
        }
    });
    
    if (!targetBranch) return; // User cancelled
    
    const confirmResult = await Swal.fire({
        title: 'Confirm merge',
        html: `Are you sure you want to merge worktree <strong>"${worktreeName}"</strong> into <strong>"${targetBranch}"</strong>?<br><br><em>This will also delete the worktree after merging.</em>`,
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
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ targetBranch: targetBranch.trim() })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            await Swal.fire({
                title: 'Success!',
                text: result.message || 'Worktree merged successfully',
                icon: 'success'
            });
            // Go back to dashboard
            showSessionsAndProjectsList();
        } else {
            await Swal.fire({
                title: 'Error',
                text: result.error || 'Failed to merge worktree',
                icon: 'error'
            });
        }
    } catch (error) {
        console.error('Error merging worktree:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Error merging worktree: ' + error.message,
            icon: 'error'
        });
    }
}

/**
 * Delete worktree
 * @param {string} projectName - Project name
 * @param {string} worktreeName - Worktree name
 */
export async function deleteWorktree(projectName, worktreeName) {
    const confirmResult = await Swal.fire({
        title: 'Delete Worktree',
        html: `Are you sure you want to delete worktree <strong>"${worktreeName}"</strong>?<br><br><em>This action cannot be undone.</em>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel'
    });
    
    if (!confirmResult.isConfirmed) return;
    
    try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}/worktrees/${encodeURIComponent(worktreeName)}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            await Swal.fire({
                title: 'Success!',
                text: result.message || 'Worktree deleted successfully',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
            // Go back to dashboard
            showSessionsAndProjectsList();
        } else {
            await Swal.fire({
                title: 'Error',
                text: result.error || 'Failed to delete worktree',
                icon: 'error'
            });
        }
    } catch (error) {
        console.error('Error deleting worktree:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Error deleting worktree: ' + error.message,
            icon: 'error'
        });
    }
} 