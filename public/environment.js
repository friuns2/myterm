// Environment variables management functionality

// Function to show environment variables management interface
async function showEnvironmentManager() {
    try {
        const response = await fetch('/api/environment');
        const envVars = await response.json();
        
        const terminalContainer = document.getElementById('terminal-container');
        terminalContainer.innerHTML = `
            <div class="p-6 max-w-4xl mx-auto h-full flex flex-col overflow-y-auto">
                <div class="flex items-center justify-between mb-6">
                    <h1 class="text-3xl font-bold">Global Environment Variables</h1>
                    <button id="back-to-dashboard" class="btn btn-outline">← Back to Dashboard</button>
                </div>
                
                <div class="bg-base-200 rounded-lg p-4 mb-6">
                    <p class="text-sm opacity-70 mb-2">
                        These environment variables will be available in all new terminal sessions across all projects.
                        Existing sessions will need to be restarted to pick up changes.
                    </p>
                </div>
                
                <!-- Add New Variable Section -->
                <div class="bg-base-100 rounded-lg p-4 mb-6 border border-base-300">
                    <h2 class="text-xl font-semibold mb-4">Add New Variable</h2>
                    <div class="flex gap-2 mb-2">
                        <input type="text" id="new-var-name" placeholder="Variable name (e.g., NODE_ENV)" 
                               class="input input-bordered flex-1" />
                        <input type="text" id="new-var-value" placeholder="Variable value" 
                               class="input input-bordered flex-1" />
                        <button id="add-variable" class="btn btn-primary">Add</button>
                    </div>
                </div>
                
                <!-- Existing Variables Section -->
                <div class="bg-base-100 rounded-lg p-4 border border-base-300 flex-1">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-xl font-semibold">Current Variables (${Object.keys(envVars).length})</h2>
                        <button id="clear-all-vars" class="btn btn-error btn-sm" 
                                ${Object.keys(envVars).length === 0 ? 'disabled' : ''}>
                            Clear All
                        </button>
                    </div>
                    
                    <div id="variables-list" class="space-y-2 max-h-96 overflow-y-auto">
                        ${Object.keys(envVars).length === 0 ? 
                            '<div class="text-center py-8 opacity-50">No environment variables configured</div>' :
                            Object.entries(envVars).map(([key, value]) => `
                                <div class="flex items-center gap-2 p-3 bg-base-200 rounded border" data-var-key="${key}">
                                    <div class="flex-1 grid grid-cols-2 gap-2">
                                        <input type="text" value="${key}" 
                                               class="input input-sm input-bordered var-name" readonly />
                                        <input type="text" value="${value}" 
                                               class="input input-sm input-bordered var-value" />
                                    </div>
                                    <button class="btn btn-sm btn-outline edit-var">Edit</button>
                                    <button class="btn btn-sm btn-success save-var hidden">Save</button>
                                    <button class="btn btn-sm btn-outline cancel-edit hidden">Cancel</button>
                                    <button class="btn btn-sm btn-error delete-var">Delete</button>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
            </div>
        `;
        
        // Set up event listeners
        setupEnvironmentEventListeners();
        
    } catch (error) {
        console.error('Error loading environment variables:', error);
        Swal.fire({
            title: 'Error',
            text: 'Failed to load environment variables',
            icon: 'error'
        });
    }
}

// Set up event listeners for environment management
function setupEnvironmentEventListeners() {
    // Back to dashboard
    document.getElementById('back-to-dashboard')?.addEventListener('click', () => {
        showSessionsAndProjectsList();
    });
    
    // Add new variable
    document.getElementById('add-variable')?.addEventListener('click', addNewVariable);
    
    // Enter key in input fields to add variable
    document.getElementById('new-var-name')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('new-var-value')?.focus();
        }
    });
    
    document.getElementById('new-var-value')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addNewVariable();
        }
    });
    
    // Clear all variables
    document.getElementById('clear-all-vars')?.addEventListener('click', clearAllVariables);
    
    // Variable list event delegation
    document.getElementById('variables-list')?.addEventListener('click', handleVariableAction);
}

// Add new environment variable
async function addNewVariable() {
    const nameInput = document.getElementById('new-var-name');
    const valueInput = document.getElementById('new-var-value');
    
    const name = nameInput.value.trim();
    const value = valueInput.value.trim();
    
    if (!name) {
        Swal.fire({
            title: 'Error',
            text: 'Variable name is required',
            icon: 'error'
        });
        return;
    }
    
    if (!value) {
        Swal.fire({
            title: 'Error',
            text: 'Variable value is required',
            icon: 'error'
        });
        return;
    }
    
    try {
        const response = await fetch('/api/environment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                variables: { [name]: value }
            })
        });
        
        if (response.ok) {
            nameInput.value = '';
            valueInput.value = '';
            showEnvironmentManager(); // Refresh the list
            
            Swal.fire({
                title: 'Success',
                text: 'Environment variable added successfully',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add variable');
        }
    } catch (error) {
        console.error('Error adding variable:', error);
        Swal.fire({
            title: 'Error',
            text: error.message || 'Failed to add environment variable',
            icon: 'error'
        });
    }
}

// Handle variable actions (edit, save, cancel, delete)
function handleVariableAction(event) {
    const target = event.target;
    const varRow = target.closest('[data-var-key]');
    
    if (!varRow) return;
    
    const varKey = varRow.dataset.varKey;
    
    if (target.classList.contains('edit-var')) {
        editVariable(varRow);
    } else if (target.classList.contains('save-var')) {
        saveVariable(varRow, varKey);
    } else if (target.classList.contains('cancel-edit')) {
        cancelEdit(varRow);
    } else if (target.classList.contains('delete-var')) {
        deleteVariable(varKey);
    }
}

// Edit variable
function editVariable(varRow) {
    const nameInput = varRow.querySelector('.var-name');
    const valueInput = varRow.querySelector('.var-value');
    const editBtn = varRow.querySelector('.edit-var');
    const saveBtn = varRow.querySelector('.save-var');
    const cancelBtn = varRow.querySelector('.cancel-edit');
    const deleteBtn = varRow.querySelector('.delete-var');
    
    // Store original values
    varRow.dataset.originalName = nameInput.value;
    varRow.dataset.originalValue = valueInput.value;
    
    // Enable editing
    nameInput.removeAttribute('readonly');
    valueInput.removeAttribute('readonly');
    
    // Toggle buttons
    editBtn.classList.add('hidden');
    deleteBtn.classList.add('hidden');
    saveBtn.classList.remove('hidden');
    cancelBtn.classList.remove('hidden');
    
    // Focus on value input
    valueInput.focus();
    valueInput.select();
}

// Save variable changes
async function saveVariable(varRow, originalKey) {
    const nameInput = varRow.querySelector('.var-name');
    const valueInput = varRow.querySelector('.var-value');
    
    const newName = nameInput.value.trim();
    const newValue = valueInput.value.trim();
    
    if (!newName || !newValue) {
        Swal.fire({
            title: 'Error',
            text: 'Both name and value are required',
            icon: 'error'
        });
        return;
    }
    
    try {
        // If name changed, we need to delete the old one and add the new one
        if (newName !== originalKey) {
            // Delete old variable
            await fetch('/api/environment', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    keys: [originalKey]
                })
            });
        }
        
        // Add/update variable
        const response = await fetch('/api/environment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                variables: { [newName]: newValue }
            })
        });
        
        if (response.ok) {
            showEnvironmentManager(); // Refresh the list
            
            Swal.fire({
                title: 'Success',
                text: 'Environment variable updated successfully',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update variable');
        }
    } catch (error) {
        console.error('Error updating variable:', error);
        Swal.fire({
            title: 'Error',
            text: error.message || 'Failed to update environment variable',
            icon: 'error'
        });
    }
}

// Cancel edit
function cancelEdit(varRow) {
    const nameInput = varRow.querySelector('.var-name');
    const valueInput = varRow.querySelector('.var-value');
    const editBtn = varRow.querySelector('.edit-var');
    const saveBtn = varRow.querySelector('.save-var');
    const cancelBtn = varRow.querySelector('.cancel-edit');
    const deleteBtn = varRow.querySelector('.delete-var');
    
    // Restore original values
    nameInput.value = varRow.dataset.originalName;
    valueInput.value = varRow.dataset.originalValue;
    
    // Disable editing
    nameInput.setAttribute('readonly', true);
    valueInput.setAttribute('readonly', true);
    
    // Toggle buttons
    editBtn.classList.remove('hidden');
    deleteBtn.classList.remove('hidden');
    saveBtn.classList.add('hidden');
    cancelBtn.classList.add('hidden');
}

// Delete variable
async function deleteVariable(varKey) {
    const result = await Swal.fire({
        title: 'Delete Variable',
        text: `Are you sure you want to delete the environment variable "${varKey}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!'
    });
    
    if (result.isConfirmed) {
        try {
            const response = await fetch('/api/environment', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    keys: [varKey]
                })
            });
            
            if (response.ok) {
                showEnvironmentManager(); // Refresh the list
                
                Swal.fire({
                    title: 'Deleted!',
                    text: 'Environment variable has been deleted.',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete variable');
            }
        } catch (error) {
            console.error('Error deleting variable:', error);
            Swal.fire({
                title: 'Error',
                text: error.message || 'Failed to delete environment variable',
                icon: 'error'
            });
        }
    }
}

// Clear all variables
async function clearAllVariables() {
    const result = await Swal.fire({
        title: 'Clear All Variables',
        text: 'Are you sure you want to delete ALL environment variables? This action cannot be undone.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, clear all!'
    });
    
    if (result.isConfirmed) {
        try {
            const response = await fetch('/api/environment/all', {
                method: 'DELETE'
            });
            
            if (response.ok) {
                showEnvironmentManager(); // Refresh the list
                
                Swal.fire({
                    title: 'Cleared!',
                    text: 'All environment variables have been deleted.',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to clear variables');
            }
        } catch (error) {
            console.error('Error clearing variables:', error);
            Swal.fire({
                title: 'Error',
                text: error.message || 'Failed to clear environment variables',
                icon: 'error'
            });
        }
    }
}