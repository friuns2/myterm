// Shell Configuration Management

let shellConfigs = {};
let currentEditingProfile = null;

// Load shell configurations from server
async function loadShellConfigs() {
    try {
        const response = await fetch('/api/shell-config');
        if (response.ok) {
            shellConfigs = await response.json();
            renderShellConfigList();
            updateActiveProfileDisplay();
        } else {
            console.error('Failed to load shell configurations');
        }
    } catch (error) {
        console.error('Error loading shell configurations:', error);
    }
}

// Render shell configuration list
function renderShellConfigList() {
    const container = document.getElementById('shell-config-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    Object.entries(shellConfigs.profiles || {}).forEach(([key, profile]) => {
        const isActive = key === shellConfigs.active_profile;
        
        const profileElement = document.createElement('div');
        profileElement.className = `shell-profile-item ${isActive ? 'active' : ''}`;
        profileElement.innerHTML = `
            <div class="profile-header">
                <div class="profile-info">
                    <h3>${escapeHtml(profile.name)} ${isActive ? '<span class="badge badge-primary">Active</span>' : ''}</h3>
                    <p class="text-sm text-gray-600">${escapeHtml(profile.description || 'No description')}</p>
                    <small class="text-xs text-gray-500">Created: ${new Date(profile.created_at).toLocaleDateString()}</small>
                </div>
                <div class="profile-actions">
                    <button class="btn btn-sm btn-outline" onclick="editShellProfile('${key}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    ${!isActive ? `<button class="btn btn-sm btn-primary" onclick="setActiveProfile('${key}')">
                        <i class="fas fa-check"></i> Activate
                    </button>` : ''}
                    ${key !== 'default' ? `<button class="btn btn-sm btn-error" onclick="deleteShellProfile('${key}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>` : ''}
                </div>
            </div>
        `;
        
        container.appendChild(profileElement);
    });
}

// Update active profile display
function updateActiveProfileDisplay() {
    const activeProfileElement = document.getElementById('active-profile-name');
    if (activeProfileElement && shellConfigs.profiles) {
        const activeProfile = shellConfigs.profiles[shellConfigs.active_profile];
        activeProfileElement.textContent = activeProfile ? activeProfile.name : 'Unknown';
    }
}

// Show shell configuration modal
function showShellConfigModal() {
    const modal = document.getElementById('shell-config-modal');
    if (modal) {
        modal.style.display = 'block';
        loadShellConfigs();
    }
}

// Hide shell configuration modal
function hideShellConfigModal() {
    const modal = document.getElementById('shell-config-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Show create profile modal
function showCreateProfileModal() {
    currentEditingProfile = null;
    document.getElementById('profile-modal-title').textContent = 'Create New Shell Profile';
    document.getElementById('profile-name').value = '';
    document.getElementById('profile-description').value = '';
    document.getElementById('profile-zshrc').value = '# Custom shell configuration\nexport PATH="$PATH:/usr/local/bin"\nalias ll="ls -la"\nalias la="ls -A"\nalias l="ls -CF"\n\n# Enable command completion\nautoload -U compinit\ncompinit\n\n# History settings\nHISTSIZE=10000\nSAVEHIST=10000\nsetopt HIST_IGNORE_DUPS\nsetopt HIST_FIND_NO_DUPS\nsetopt SHARE_HISTORY';
    document.getElementById('profile-env-vars').value = '{}';
    
    const modal = document.getElementById('profile-edit-modal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// Edit shell profile
function editShellProfile(profileKey) {
    currentEditingProfile = profileKey;
    const profile = shellConfigs.profiles[profileKey];
    
    if (!profile) return;
    
    document.getElementById('profile-modal-title').textContent = 'Edit Shell Profile';
    document.getElementById('profile-name').value = profile.name;
    document.getElementById('profile-description').value = profile.description || '';
    document.getElementById('profile-zshrc').value = profile.zshrc_content || '';
    document.getElementById('profile-env-vars').value = JSON.stringify(profile.environment_vars || {}, null, 2);
    
    const modal = document.getElementById('profile-edit-modal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// Hide profile edit modal
function hideProfileEditModal() {
    const modal = document.getElementById('profile-edit-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    currentEditingProfile = null;
}

// Save shell profile
async function saveShellProfile() {
    const name = document.getElementById('profile-name').value.trim();
    const description = document.getElementById('profile-description').value.trim();
    const zshrcContent = document.getElementById('profile-zshrc').value;
    let envVars = {};
    
    try {
        envVars = JSON.parse(document.getElementById('profile-env-vars').value || '{}');
    } catch (error) {
        alert('Invalid JSON in environment variables field');
        return;
    }
    
    if (!name) {
        alert('Profile name is required');
        return;
    }
    
    const profileData = {
        name,
        description,
        zshrc_content: zshrcContent,
        environment_vars: envVars
    };
    
    try {
        let response;
        if (currentEditingProfile) {
            // Update existing profile
            response = await fetch(`/api/shell-config/profiles/${currentEditingProfile}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(profileData)
            });
        } else {
            // Create new profile
            response = await fetch('/api/shell-config/profiles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(profileData)
            });
        }
        
        if (response.ok) {
            hideProfileEditModal();
            loadShellConfigs();
            showNotification(currentEditingProfile ? 'Profile updated successfully' : 'Profile created successfully', 'success');
        } else {
            const error = await response.json();
            alert(error.error || 'Failed to save profile');
        }
    } catch (error) {
        console.error('Error saving profile:', error);
        alert('Error saving profile');
    }
}

// Set active profile
async function setActiveProfile(profileKey) {
    try {
        const response = await fetch(`/api/shell-config/active/${profileKey}`, {
            method: 'POST'
        });
        
        if (response.ok) {
            loadShellConfigs();
            showNotification('Active profile changed successfully', 'success');
        } else {
            const error = await response.json();
            alert(error.error || 'Failed to set active profile');
        }
    } catch (error) {
        console.error('Error setting active profile:', error);
        alert('Error setting active profile');
    }
}

// Delete shell profile
async function deleteShellProfile(profileKey) {
    if (profileKey === 'default') {
        alert('Cannot delete default profile');
        return;
    }
    
    if (!confirm('Are you sure you want to delete this profile?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/shell-config/profiles/${profileKey}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadShellConfigs();
            showNotification('Profile deleted successfully', 'success');
        } else {
            const error = await response.json();
            alert(error.error || 'Failed to delete profile');
        }
    } catch (error) {
        console.error('Error deleting profile:', error);
        alert('Error deleting profile');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${escapeHtml(message)}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 3000);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize shell configuration management
document.addEventListener('DOMContentLoaded', () => {
    // Load initial data
    loadShellConfigs();
    
    // Set up modal close handlers
    document.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
});