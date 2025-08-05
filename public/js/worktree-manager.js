// Worktree management module

async function createWorktreeModal(projectName) {
    const { value: formValues } = await Swal.fire({
        title: 'Create New Worktree',
        html: `
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-1">Worktree Name</label>
                    <input id="worktree-name" class="swal2-input" placeholder="Enter worktree name">
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">Branch Name</label>
                    <input id="branch-name" class="swal2-input" placeholder="Enter branch name">
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Create Worktree',
        preConfirm: () => {
            const worktreeName = document.getElementById('worktree-name').value;
            const branchName = document.getElementById('branch-name').value;
            
            if (!worktreeName) {
                Swal.showValidationMessage('Please enter a worktree name');
                return false;
            }
            if (!branchName) {
                Swal.showValidationMessage('Please enter a branch name');
                return false;
            }
            
            return { worktreeName, branchName };
        }
    });

    if (formValues) {
        await createWorktree(projectName, formValues.worktreeName, formValues.branchName);
    }
}

async function createWorktree(projectName, worktreeName, branchName) {
    if (!worktreeName) {
        await Swal.fire({
            title: 'Error',
            text: 'Please enter a worktree name',
            icon: 'error'
        });
        return;
    }

    try {
        const response = await fetch('/api/worktrees', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                projectName: projectName,
                worktreeName: worktreeName,
                branchName: branchName
            })
        });

        const result = await response.json();

        if (response.ok) {
            await Swal.fire({
                title: 'Success',
                text: 'Worktree created successfully',
                icon: 'success'
            });
            
            // Refresh the current view
            if (window.currentProject) {
                window.ProjectModule.showProjectSessions(window.currentProject);
            } else {
                window.ProjectModule.showSessionsAndProjectsList();
            }
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
            text: 'Error creating worktree',
            icon: 'error'
        });
    }
}

function openWorktree(projectName, worktreeName) {
    window.currentProject = projectName;
    window.currentWorktree = worktreeName;
    window.sessionID = null;
    window.URLModule.updateURLWithProject(projectName);
    window.TerminalModule.initializeTerminal();
}

async function mergeWorktree(projectName, worktreeName) {
    const { value: nextKey } = await Swal.fire({
        title: 'Merge Worktree',
        input: 'text',
        inputLabel: 'Target Branch',
        inputPlaceholder: 'Enter target branch name (e.g., main, master)',
        showCancelButton: true,
        inputValidator: (value) => {
            if (!value) {
                return 'You need to enter a target branch name!';
            }
        }
    });

    if (!nextKey) return;

    try {
        const response = await fetch('/api/worktrees/merge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                projectName: projectName,
                worktreeName: worktreeName,
                targetBranch: nextKey
            })
        });

        const result = await response.json();

        if (response.ok) {
            await Swal.fire({
                title: 'Success',
                text: 'Worktree merged successfully',
                icon: 'success'
            });
            
            // Refresh the current view
            if (window.currentProject) {
                window.ProjectModule.showProjectSessions(window.currentProject);
            } else {
                window.ProjectModule.showSessionsAndProjectsList();
            }
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
            text: 'Error merging worktree',
            icon: 'error'
        });
    }
}

async function deleteWorktree(projectName, worktreeName) {
    const result = await Swal.fire({
        title: 'Delete Worktree',
        text: `Are you sure you want to delete the worktree "${worktreeName}"? This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    try {
        const response = await fetch('/api/worktrees', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                projectName: projectName,
                worktreeName: worktreeName
            })
        });

        const deleteResult = await response.json();

        if (response.ok) {
            await Swal.fire({
                title: 'Deleted!',
                text: 'Worktree has been deleted successfully.',
                icon: 'success'
            });
            
            // Refresh the current view
            if (window.currentProject) {
                window.ProjectModule.showProjectSessions(window.currentProject);
            } else {
                window.ProjectModule.showSessionsAndProjectsList();
            }
        } else {
            await Swal.fire({
                title: 'Error',
                text: deleteResult.error || 'Failed to delete worktree',
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

// Export functions for use in other modules
window.WorktreeModule = {
    createWorktreeModal,
    createWorktree,
    openWorktree,
    mergeWorktree,
    deleteWorktree
};