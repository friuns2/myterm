// File browser module

import { getCurrentProject } from './websocket.js';

// File browser state
let currentBrowserPath = null;
let isFileBrowserOpen = false;

/**
 * Toggle file browser visibility
 */
export async function toggleFileBrowser() {
    const fileBrowser = document.getElementById('file-browser');
    if (!fileBrowser) {
        console.error('File browser element not found');
        return;
    }
    
    if (isFileBrowserOpen) {
        closeBrowser();
    } else {
        await openBrowser();
    }
}

/**
 * Open file browser
 */
async function openBrowser() {
    const fileBrowser = document.getElementById('file-browser');
    if (!fileBrowser) return;
    
    fileBrowser.classList.remove('hidden');
    fileBrowser.classList.add('flex', 'fullscreen');
    isFileBrowserOpen = true;
    
    // Load initial directory (project directory or home)
    const currentProject = getCurrentProject();
    const initialPath = currentProject ? 
        `../projects/${currentProject}` : 
        (process.env.HOME || '~');
    
    await loadDirectory(initialPath);
}

/**
 * Close file browser
 */
function closeBrowser() {
    const fileBrowser = document.getElementById('file-browser');
    if (!fileBrowser) return;
    
    fileBrowser.classList.add('hidden');
    fileBrowser.classList.remove('flex', 'fullscreen');
    isFileBrowserOpen = false;
}

/**
 * Load directory contents
 * @param {string} dirPath - Directory path to load
 */
export async function loadDirectory(dirPath) {
    try {
        const response = await fetch(`/api/browse?path=${encodeURIComponent(dirPath)}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to load directory');
        }
        
        currentBrowserPath = data.currentPath;
        displayDirectoryContents(data);
        
        // Update current directory input
        const currentDirInput = document.getElementById('current-dir');
        if (currentDirInput) {
            currentDirInput.value = data.currentPath;
        }
    } catch (error) {
        console.error('Error loading directory:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Failed to load directory: ' + error.message,
            icon: 'error'
        });
    }
}

/**
 * Display directory contents in the file list
 * @param {Object} data - Directory data from server
 */
function displayDirectoryContents(data) {
    const fileList = document.getElementById('file-list');
    if (!fileList) {
        console.error('File list element not found');
        return;
    }
    
    fileList.innerHTML = '';
    
    // Add parent directory link if not at root
    if (data.parentPath && data.parentPath !== data.currentPath) {
        const parentItem = createFileItem({
            name: '..',
            type: 'directory',
            path: data.parentPath
        });
        fileList.appendChild(parentItem);
    }
    
    // Add directory contents
    data.items.forEach(item => {
        const fileItem = createFileItem(item);
        fileList.appendChild(fileItem);
    });
}

/**
 * Create a file item element
 * @param {Object} item - File/directory item data
 * @returns {HTMLElement} - File item element
 */
function createFileItem(item) {
    const div = document.createElement('div');
    div.className = 'file-item p-2 rounded cursor-pointer flex items-center gap-2 text-sm hover:bg-base-300 transition-colors';
    
    const icon = item.type === 'directory' ? '📁' : '📄';
    const name = item.name.length > 25 ? item.name.substring(0, 22) + '...' : item.name;
    
    div.innerHTML = `
        <span class="text-lg">${icon}</span>
        <span class="flex-1 truncate" title="${item.name}">${name}</span>
    `;
    
    div.addEventListener('click', () => {
        if (item.type === 'directory') {
            loadDirectory(item.path);
        } else {
            // Import file editor to avoid circular dependency
            import('./fileEditor.js').then(fileEditor => {
                fileEditor.openFileInEditor(item.path);
            });
        }
    });
    
    return div;
}

/**
 * Create new file
 */
export function createNewFile() {
    const modal = document.getElementById('new-file-modal');
    const input = document.getElementById('new-file-name');
    if (!modal || !input) {
        console.error('New file modal elements not found');
        return;
    }
    
    input.value = '';
    modal.showModal();
    input.focus();
}

/**
 * Create new folder
 */
export function createNewFolder() {
    const modal = document.getElementById('new-folder-modal');
    const input = document.getElementById('new-folder-name');
    if (!modal || !input) {
        console.error('New folder modal elements not found');
        return;
    }
    
    input.value = '';
    modal.showModal();
    input.focus();
}

/**
 * Handle file creation
 */
export async function handleFileCreation() {
    const input = document.getElementById('new-file-name');
    if (!input) {
        console.error('New file name input not found');
        return;
    }
    
    const fileName = input.value.trim();
    if (!fileName) return;
    
    if (!currentBrowserPath) {
        await Swal.fire({
            title: 'Warning',
            text: 'No directory selected',
            icon: 'warning'
        });
        return;
    }
    
    const filePath = `${currentBrowserPath}/${fileName}`;
    
    try {
        const response = await fetch('/api/file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: filePath,
                content: ''
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to create file');
        }
        
        // Refresh directory listing
        await loadDirectory(currentBrowserPath);
        
        // Open the new file in editor
        import('./fileEditor.js').then(fileEditor => {
            fileEditor.openFileInEditor(filePath);
        });
        
        const modal = document.getElementById('new-file-modal');
        if (modal) {
            modal.close();
        }
        
    } catch (error) {
        console.error('Error creating file:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Failed to create file: ' + error.message,
            icon: 'error'
        });
    }
}

/**
 * Handle folder creation
 */
export async function handleFolderCreation() {
    const input = document.getElementById('new-folder-name');
    if (!input) {
        console.error('New folder name input not found');
        return;
    }
    
    const folderName = input.value.trim();
    if (!folderName) return;
    
    if (!currentBrowserPath) {
        await Swal.fire({
            title: 'Warning',
            text: 'No directory selected',
            icon: 'warning'
        });
        return;
    }
    
    const folderPath = `${currentBrowserPath}/${folderName}`;
    
    try {
        const response = await fetch('/api/folder', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ path: folderPath })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to create folder');
        }
        
        // Refresh directory listing
        await loadDirectory(currentBrowserPath);
        
        const modal = document.getElementById('new-folder-modal');
        if (modal) {
            modal.close();
        }
        
    } catch (error) {
        console.error('Error creating folder:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Failed to create folder: ' + error.message,
            icon: 'error'
        });
    }
}

/**
 * Close file browser
 */
export function closeFileBrowser() {
    closeBrowser();
}

/**
 * Check if file browser is open
 * @returns {boolean} - Browser open status
 */
export function getFileBrowserOpenStatus() {
    return isFileBrowserOpen;
}

/**
 * Get current browser path
 * @returns {string|null} - Current browser path
 */
export function getCurrentBrowserPath() {
    return currentBrowserPath;
} 