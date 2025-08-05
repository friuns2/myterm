// File browser module

// File browser state
let currentBrowserPath = null;

async function toggleFileBrowser() {
    if (isFileBrowserOpen) {
        closeFileBrowser();
    } else {
        // Load current directory
        try {
            const response = await fetch('/api/current-directory');
            const data = await response.json();
            currentBrowserPath = data.path;
            await loadDirectory(currentBrowserPath);
        } catch (error) {
            console.error('Error getting current directory:', error);
            alert('Error loading file browser');
        }
    }
}

async function loadDirectory(dirPath) {
    try {
        const response = await fetch(`/api/directory?path=${encodeURIComponent(dirPath)}`);
        const data = await response.json();
        
        if (response.ok) {
            currentBrowserPath = dirPath;
            displayDirectoryContents(data);
        } else {
            alert(data.error || 'Error loading directory');
        }
    } catch (error) {
        console.error('Error loading directory:', error);
        alert('Error loading directory');
    }
}

function displayDirectoryContents(data) {
    const fileBrowser = document.getElementById('file-browser');
    if (!fileBrowser) return;
    
    fileBrowser.classList.remove('hidden');
    isFileBrowserOpen = true;
    
    const browseFilesBtn = document.getElementById('browse-files');
    if (browseFilesBtn) {
        browseFilesBtn.style.display = 'none';
    }
    
    const fileList = fileBrowser.querySelector('#file-list');
    fileList.innerHTML = '';
    
    // Add parent directory link if not at root
    if (data.parent) {
        const parentItem = createFileItem({
            name: '..',
            type: 'directory',
            path: data.parent
        });
        fileList.appendChild(parentItem);
    }
    
    // Add directories first, then files
    const sortedItems = [...data.items].sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
    });
    
    sortedItems.forEach(item => {
        const fileItem = createFileItem(item);
        fileList.appendChild(fileItem);
    });
}

function createFileItem(item) {
    const div = document.createElement('div');
    div.className = 'file-item p-2 hover:bg-base-300 cursor-pointer flex items-center gap-2';
    
    const icon = item.type === 'directory' ? '📁' : '📄';
    div.innerHTML = `
        <span class="text-lg">${icon}</span>
        <span class="flex-1 text-sm">${item.name}</span>
    `;
    
    div.addEventListener('click', () => {
        if (item.type === 'directory') {
            loadDirectory(item.path);
        } else {
            window.fileEditor.openFileInEditor(item.path);
        }
    });
    
    return div;
}

function closeFileBrowser() {
    const fileBrowser = document.getElementById('file-browser');
    if (fileBrowser) {
        fileBrowser.classList.add('hidden');
    }
    isFileBrowserOpen = false;
    
    const browseFilesBtn = document.getElementById('browse-files');
    if (browseFilesBtn) {
        browseFilesBtn.style.display = 'block';
    }
}

function createNewFile() {
    const modal = document.getElementById('new-file-modal');
    if (modal) {
        modal.showModal();
        document.getElementById('new-file-name').focus();
    }
}

function createNewFolder() {
    const modal = document.getElementById('new-folder-modal');
    if (modal) {
        modal.showModal();
        document.getElementById('new-folder-name').focus();
    }
}

async function handleFileCreation() {
    const nameInput = document.getElementById('new-file-name');
    const fileName = nameInput.value.trim();
    
    if (!fileName) {
        alert('Please enter a file name');
        return;
    }
    
    try {
        const response = await fetch('/api/files', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: currentBrowserPath,
                name: fileName,
                type: 'file'
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            document.getElementById('new-file-modal').close();
            nameInput.value = '';
            // Refresh directory listing
            await loadDirectory(currentBrowserPath);
            // Open the new file in editor
            window.fileEditor.openFileInEditor(result.path);
        } else {
            alert(result.error || 'Failed to create file');
        }
    } catch (error) {
        console.error('Error creating file:', error);
        alert('Error creating file');
    }
}

async function handleFolderCreation() {
    const nameInput = document.getElementById('new-folder-name');
    const folderName = nameInput.value.trim();
    
    if (!folderName) {
        alert('Please enter a folder name');
        return;
    }
    
    try {
        const response = await fetch('/api/files', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: currentBrowserPath,
                name: folderName,
                type: 'directory'
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            document.getElementById('new-folder-modal').close();
            nameInput.value = '';
            // Refresh directory listing
            await loadDirectory(currentBrowserPath);
        } else {
            alert(result.error || 'Failed to create folder');
        }
    } catch (error) {
        console.error('Error creating folder:', error);
        alert('Error creating folder');
    }
}

// Export functions for use in other modules
window.fileBrowser = {
    toggleFileBrowser,
    loadDirectory,
    displayDirectoryContents,
    createFileItem,
    closeFileBrowser,
    createNewFile,
    createNewFolder,
    handleFileCreation,
    handleFolderCreation,
    getCurrentPath: () => currentBrowserPath,
    isOpen: () => isFileBrowserOpen
};

// Make functions globally available for onclick handlers
window.toggleFileBrowser = toggleFileBrowser;
window.createNewFile = createNewFile;
window.createNewFolder = createNewFolder;
window.handleFileCreation = handleFileCreation;
window.handleFolderCreation = handleFolderCreation;