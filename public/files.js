// File browser and editor functionality

// File browser and editor state
let currentBrowserPath = null;
let currentEditingFile = null;
let isFileBrowserOpen = false;
let isFileEditorOpen = false;

async function toggleFileBrowser() {
    const fileBrowser = document.getElementById('file-browser');
    
    if (isFileBrowserOpen) {
        fileBrowser.classList.add('hidden');
        fileBrowser.classList.remove('flex', 'fullscreen');
        isFileBrowserOpen = false;
    } else {
        fileBrowser.classList.remove('hidden');
        fileBrowser.classList.add('flex', 'fullscreen');
        isFileBrowserOpen = true;
        
        // Load initial directory (session path if available, else project dir, else home)
        const initialPath = (window.__lastSessionPath && typeof window.__lastSessionPath === 'string' && window.__lastSessionPath) ?
            window.__lastSessionPath :
            (currentProject ? `../projects/${currentProject}` : '/');
        await loadDirectory(initialPath);
    }
}

// Function to open a file in a new tab
function openFileInNewTab(filePath) {
    const viewUrl = `/api/view?path=${encodeURIComponent(filePath)}`;
    window.open(viewUrl, '_blank');
}

async function loadDirectory(dirPath) {
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

function displayDirectoryContents(data) {
    const fileList = document.getElementById('file-list');
    if (!fileList) return;
    
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

function createFileItem(item) {
    const div = document.createElement('div');
    div.className = 'file-item p-2 rounded cursor-pointer flex items-center gap-2 text-sm';
    
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
            openFileInEditor(item.path);
        }
    });
    
    return div;
}

async function openFileInEditor(filePath) {
    try {
        const response = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
        const data = await response.json();
        
        if (!response.ok) {
            // If it's not a text file, open it directly in a new tab
            if (data.isTextFile === false) {
                openFileInNewTab(filePath);
                return;
            }
            throw new Error(data.error || 'Failed to load file');
        }
        
        currentEditingFile = data.path;
        
        // Show editor panel in fullscreen
        const fileEditor = document.getElementById('file-editor');
        fileEditor.classList.remove('hidden');
        fileEditor.classList.add('flex', 'fullscreen');
        isFileEditorOpen = true;
        
        // Update editor content
        const fileContent = document.getElementById('file-content');
        const editorFilename = document.getElementById('editor-filename');
        
        if (fileContent) {
            fileContent.value = data.content;
        }
        
        if (editorFilename) {
            const filename = filePath.split('/').pop();
            editorFilename.textContent = filename;
        }
        
    } catch (error) {
        console.error('Error opening file:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Failed to open file: ' + error.message,
            icon: 'error'
        });
    }
}

async function saveCurrentFile() {
    if (!currentEditingFile) {
        await Swal.fire({
            title: 'Warning',
            text: 'No file is currently being edited',
            icon: 'warning'
        });
        return;
    }
    
    try {
        const fileContent = document.getElementById('file-content');
        const content = fileContent ? fileContent.value : '';
        
        const response = await fetch('/api/file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: currentEditingFile,
                content: content
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to save file');
        }
        
        // Show success feedback
        const saveButton = document.getElementById('save-file');
        if (saveButton) {
            const originalText = saveButton.textContent;
            saveButton.textContent = 'Saved!';
            saveButton.classList.add('btn-success');
            setTimeout(() => {
                saveButton.textContent = originalText;
            }, 1000);
        }
        
    } catch (error) {
        console.error('Error saving file:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Failed to save file: ' + error.message,
            icon: 'error'
        });
    }
}

function closeFileEditor() {
    const fileEditor = document.getElementById('file-editor');
    fileEditor.classList.add('hidden');
    fileEditor.classList.remove('flex', 'fullscreen');
    isFileEditorOpen = false;
    currentEditingFile = null;
}

function closeFileBrowser() {
    const fileBrowser = document.getElementById('file-browser');
    fileBrowser.classList.add('hidden');
    fileBrowser.classList.remove('flex', 'fullscreen');
    isFileBrowserOpen = false;
}

// Create new file function
function createNewFile() {
    const modal = document.getElementById('new-file-modal');
    const input = document.getElementById('new-file-name');
    input.value = '';
    modal.showModal();
    input.focus();
}

// Create new folder function
function createNewFolder() {
    const modal = document.getElementById('new-folder-modal');
    const input = document.getElementById('new-folder-name');
    input.value = '';
    modal.showModal();
    input.focus();
}

// Handle file creation
async function handleFileCreation() {
    const input = document.getElementById('new-file-name');
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
        await openFileInEditor(filePath);
        
        document.getElementById('new-file-modal').close();
        
    } catch (error) {
        console.error('Error creating file:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Failed to create file: ' + error.message,
            icon: 'error'
        });
    }
}

// Handle folder creation
async function handleFolderCreation() {
    const input = document.getElementById('new-folder-name');
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
        
        document.getElementById('new-folder-modal').close();
        
    } catch (error) {
        console.error('Error creating folder:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Failed to create folder: ' + error.message,
            icon: 'error'
        });
    }
}

// File upload functionality
async function handleFileUpload() {
    const fileInput = document.getElementById('file-upload-input');
    const files = fileInput.files;
    
    if (files.length === 0) {
        await Swal.fire({
            title: 'No Files Selected',
            text: 'Please select files to upload',
            icon: 'warning'
        });
        return;
    }
    
    if (!currentBrowserPath) {
        await Swal.fire({
            title: 'Error',
            text: 'No directory selected for upload',
            icon: 'error'
        });
        return;
    }
    
    try {
        const formData = new FormData();
        
        // Add all selected files to FormData
        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
        }
        
        // Add upload path
        formData.append('uploadPath', currentBrowserPath);
        
        // Show loading indicator
        const loadingAlert = Swal.fire({
            title: 'Uploading Files...',
            text: `Uploading ${files.length} file(s)`,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to upload files');
        }
        
        // Close loading indicator
        await loadingAlert;
        Swal.close();
        
        // Show success message
        await Swal.fire({
            title: 'Success',
            text: `Successfully uploaded ${data.files.length} file(s)`,
            icon: 'success',
            timer: 2000
        });
        
        // Clear file input
        fileInput.value = '';
        
        // Refresh directory listing
        await loadDirectory(currentBrowserPath);
        
    } catch (error) {
        console.error('Error uploading files:', error);
        await Swal.fire({
            title: 'Upload Failed',
            text: 'Failed to upload files: ' + error.message,
            icon: 'error'
        });
    }
}