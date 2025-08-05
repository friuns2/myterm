// Project management module

import { setCurrentProject, updateURLWithProject } from './websocket.js';
import { showSessionsAndProjectsList } from './sessions.js';

/**
 * Create a new project
 */
export async function createNewProject() {
    const projectNameInput = document.getElementById('project-name');
    if (!projectNameInput) {
        console.error('Project name input not found');
        return;
    }
    
    const projectName = projectNameInput.value.trim();
    
    if (!projectName) {
        await Swal.fire({
            title: 'Error',
            text: 'Please enter a project name',
            icon: 'error'
        });
        return;
    }
    
    try {
        const response = await fetch('/api/projects', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: projectName })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            selectProject(result.name);
        } else {
            await Swal.fire({
                title: 'Error',
                text: result.error || 'Failed to create project',
                icon: 'error'
            });
        }
    } catch (error) {
        console.error('Error creating project:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Error creating project',
            icon: 'error'
        });
    }
}

/**
 * Delete a project
 * @param {string} projectName - Name of the project to delete
 */
export async function deleteProject(projectName) {
    const result = await Swal.fire({
        title: 'Delete Project?',
        text: `Are you sure you want to delete the project "${projectName}"? This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}`, {
                method: 'DELETE'
            });
            
            const deleteResult = await response.json();
            
            if (response.ok) {
                await Swal.fire({
                    title: 'Deleted!',
                    text: deleteResult.message || 'Project deleted successfully',
                    icon: 'success'
                });
                // Refresh the projects list
                showSessionsAndProjectsList();
            } else {
                await Swal.fire({
                    title: 'Error',
                    text: deleteResult.error || 'Failed to delete project',
                    icon: 'error'
                });
            }
        } catch (error) {
            console.error('Error deleting project:', error);
            await Swal.fire({
                title: 'Error',
                text: 'Error deleting project',
                icon: 'error'
            });
        }
    }
}

/**
 * Select a project and initialize terminal
 * @param {string} projectName - Name of the project to select
 */
export function selectProject(projectName) {
    setCurrentProject(projectName);
    updateURLWithProject(projectName);
    
    // Import and initialize terminal here to avoid circular dependency
    import('./main.js').then(main => {
        main.initializeTerminal();
    });
}

/**
 * Show project list (legacy function, now redirects to main dashboard)
 */
export async function showProjectList() {
    console.warn('showProjectList is deprecated, redirecting to showSessionsAndProjectsList');
    await showSessionsAndProjectsList();
} 