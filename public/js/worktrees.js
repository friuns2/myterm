// Worktrees management module

// Function to create worktree modal
function createWorktreeModal(projectName) {
    // Create modal HTML
    const modalHTML = `
        <div id="worktree-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-gray-800 p-6 rounded-lg w-96 max-w-90vw">
                <h3 class="text-xl font-bold text-white mb-4">Create New Worktree</h3>
                <form id="worktree-form">
                    <div class="mb-4">
                        <label for="branch-name" class="block text-sm font-medium text-gray-300 mb-2">
                            Branch Name
                        </label>
                        <input type="text" id="branch-name" name="branchName" 
                               class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
                               placeholder="feature/new-feature" required>
                    </div>
                    <div class="mb-4">
                        <label for="base-branch" class="block text-sm font-medium text-gray-300 mb-2">
                            Base Branch (optional)
                        </label>
                        <input type="text" id="base-branch" name="baseBranch" 
                               class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
                               placeholder="main">
                    </div>
                    <div class="flex justify-end gap-3">
                        <button type="button" onclick="document.getElementById('worktree-modal').remove()" 
                                class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" 
                                class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                            Create
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('worktree-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add form submit handler
    const form = document.getElementById('worktree-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const branchName = formData.get('branchName');
        const baseBranch = formData.get('baseBranch');
        
        handleWorktreeCreation(projectName, branchName, baseBranch);
    });
    
    // Focus on branch name input
    document.getElementById('branch-name').focus();
}

// Function to handle worktree creation
async function handleWorktreeCreation(projectName, branchName, baseBranch) {
    try {
        const requestBody = {
            branchName: branchName
        };
        
        if (baseBranch && baseBranch.trim()) {
            requestBody.baseBranch = baseBranch.trim();
        }
        
        const response = await fetch(`/api/projects/${projectName}/worktrees`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Close modal
            document.getElementById('worktree-modal').remove();
            
            await Swal.fire({
                title: 'Success!',
                text: `Worktree "${branchName}" created successfully!`,
                icon: 'success'
            });
            
            // Refresh the project sessions view
            window.Projects.showProjectSessions(projectName);
        } else {
            await Swal.fire({
                title: 'Error',
                text: 'Failed to create worktree: ' + result.message,
                icon: 'error'
            });
        }
    } catch (error) {
        console.error('Error creating worktree:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Error creating worktree',
            icon: 'error'
        });
    }
}

// Function to open worktree
function openWorktree(projectName, branchName) {
    // Set the current project and clear session ID
    window.WebSocketManager.setCurrentProject(projectName);
    window.WebSocketManager.setSessionID(null);
    
    // Update URL to include project and branch
    const url = new URL(window.location);
    url.searchParams.set('project', projectName);
    url.searchParams.set('branch', branchName);
    url.searchParams.delete('session');
    window.history.pushState({ project: projectName, branch: branchName }, '', url);
    
    // Initialize terminal for this worktree
    window.Terminal.initializeTerminal();
}

// Function to merge worktree
async function mergeWorktree(projectName, branchName) {
    const { value: targetBranch } = await Swal.fire({
        title: 'Merge Worktree',
        text: `Enter the target branch to merge "${branchName}" into:`,
        input: 'text',
        inputValue: 'main',
        inputPlaceholder: 'main',
        showCancelButton: true,
        inputValidator: (value) => {
            if (!value) {
                return 'You need to enter a target branch!';
            }
        }
    });
    
    if (targetBranch) {
        try {
            const response = await fetch(`/api/projects/${projectName}/worktrees/${branchName}/merge`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ targetBranch })
            });
            
            const result = await response.json();
            
            if (result.success) {
                await Swal.fire({
                    title: 'Success!',
                    text: `Worktree "${branchName}" merged into "${targetBranch}" and deleted successfully!`,
                    icon: 'success'
                });
                
                // Refresh the project sessions view
                window.Projects.showProjectSessions(projectName);
            } else {
                await Swal.fire({
                    title: 'Error',
                    text: 'Failed to merge worktree: ' + result.message,
                    icon: 'error'
                });
            }
        } catch (error) {
            console.error('Error merging worktree:', error);
            await Swal.fire({
                title: 'Error',
                text: 'Error merging worktree',
                icon: 'error'
            });
        }
    }
}

// Function to delete worktree
async function deleteWorktree(projectName, branchName) {
    const result = await Swal.fire({
        title: 'Are you sure?',
        text: `This will permanently delete the worktree "${branchName}"!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!'
    });
    
    if (result.isConfirmed) {
        try {
            const response = await fetch(`/api/projects/${projectName}/worktrees/${branchName}`, {
                method: 'DELETE'
            });
            
            const deleteResult = await response.json();
            
            if (deleteResult.success) {
                await Swal.fire({
                    title: 'Deleted!',
                    text: `Worktree "${branchName}" has been deleted.`,
                    icon: 'success'
                });
                
                // Refresh the project sessions view
                window.Projects.showProjectSessions(projectName);
            } else {
                await Swal.fire({
                    title: 'Error',
                    text: 'Failed to delete worktree: ' + deleteResult.message,
                    icon: 'error'
                });
            }
        } catch (error) {
            console.error('Error deleting worktree:', error);
            await Swal.fire({
                title: 'Error',
                text: 'Error deleting worktree',
                icon: 'error'
            });
        }
    }
}

// Export worktrees functions
window.Worktrees = {
    createWorktreeModal,
    handleWorktreeCreation,
    openWorktree,
    mergeWorktree,
    deleteWorktree
};