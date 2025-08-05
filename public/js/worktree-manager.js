// Worktree management module

function createWorktreeModal(projectName) {
    // Check if modal already exists
    let modal = document.getElementById('new-worktree-modal');
    
    if (!modal) {
        // Create modal if it doesn't exist
        const modalHTML = `
            <dialog id="new-worktree-modal" class="modal">
                <div class="modal-box">
                    <h3 class="font-bold text-lg mb-4">Create New Worktree</h3>
                    <div class="form-control mb-4">
                        <label class="label">
                            <span class="label-text">Worktree Name</span>
                        </label>
                        <input type="text" id="new-worktree-name" placeholder="Enter worktree name" class="input input-bordered">
                    </div>
                    <div class="form-control mb-6">
                        <label class="label">
                            <span class="label-text">Branch Name (optional)</span>
                        </label>
                        <input type="text" id="new-worktree-branch" placeholder="Leave empty to create from current branch" class="input input-bordered">
                    </div>
                    <div class="modal-action">
                        <button id="create-worktree-btn" class="btn btn-primary">Create</button>
                        <button id="cancel-worktree-btn" class="btn">Cancel</button>
                    </div>
                </div>
            </dialog>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('new-worktree-modal');
        
        // Add event listeners for the new modal
        document.getElementById('create-worktree-btn').addEventListener('click', () => handleWorktreeCreation(projectName));
        document.getElementById('cancel-worktree-btn').addEventListener('click', () => {
            document.getElementById('new-worktree-modal').close();
        });
        
        const worktreeNameInput = document.getElementById('new-worktree-name');
        const worktreeBranchInput = document.getElementById('new-worktree-branch');
        
        worktreeNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleWorktreeCreation(projectName);
            }
        });
        
        worktreeBranchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleWorktreeCreation(projectName);
            }
        });
    }
    
    // Clear inputs and show modal
    document.getElementById('new-worktree-name').value = '';
    document.getElementById('new-worktree-branch').value = '';
    document.getElementById('new-worktree-modal').showModal();
    document.getElementById('new-worktree-name').focus();
}

async function handleWorktreeCreation(projectName) {
    const nameInput = document.getElementById('new-worktree-name');
    const branchInput = document.getElementById('new-worktree-branch');
    const name = nameInput.value.trim();
    const branch = branchInput.value.trim();
    
    if (!name) {
        alert('Please enter a worktree name');
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
            document.getElementById('new-worktree-modal').close();
            // Refresh the project sessions view
            window.projectManager.showProjectSessions(projectName);
        } else {
            alert(result.error || 'Failed to create worktree');
        }
    } catch (error) {
        console.error('Error creating worktree:', error);
        alert('Error creating worktree');
    }
}

function openWorktree(projectName, worktreeName) {
    // Open a new terminal session in the worktree directory
    sessionID = null;
    currentProject = `${projectName}/worktrees/${worktreeName}`;
    window.urlUtils.updateURLWithProject(currentProject);
    window.terminalModule.initializeTerminal();
}

async function mergeWorktree(projectName, worktreeName) {
    const targetBranch = prompt('Enter target branch to merge into (default: main):', 'main');
    if (targetBranch === null) return; // User cancelled
    
    const confirmMerge = confirm(`Are you sure you want to merge worktree "${worktreeName}" into "${targetBranch || 'main'}"? This will also delete the worktree.`);
    if (!confirmMerge) return;
    
    try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}/worktrees/${encodeURIComponent(worktreeName)}/merge`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ targetBranch: targetBranch || 'main' })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(result.message || 'Worktree merged successfully');
            // Refresh the project sessions view
            window.projectManager.showProjectSessions(projectName);
        } else {
            alert(result.error || 'Failed to merge worktree');
        }
    } catch (error) {
        console.error('Error merging worktree:', error);
        alert('Error merging worktree');
    }
}

async function deleteWorktree(projectName, worktreeName) {
    const confirmDelete = confirm(`Are you sure you want to delete worktree "${worktreeName}"? This action cannot be undone.`);
    if (!confirmDelete) return;
    
    try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}/worktrees/${encodeURIComponent(worktreeName)}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(result.message || 'Worktree deleted successfully');
            // Refresh the project sessions view
            window.projectManager.showProjectSessions(projectName);
        } else {
            alert(result.error || 'Failed to delete worktree');
        }
    } catch (error) {
        console.error('Error deleting worktree:', error);
        alert('Error deleting worktree');
    }
}

// Export functions for use in other modules
window.worktreeManager = {
    createWorktreeModal,
    handleWorktreeCreation,
    openWorktree,
    mergeWorktree,
    deleteWorktree
};

// Make functions globally available for onclick handlers
window.createWorktreeModal = createWorktreeModal;
window.handleWorktreeCreation = handleWorktreeCreation;
window.openWorktree = openWorktree;
window.mergeWorktree = mergeWorktree;
window.deleteWorktree = deleteWorktree;