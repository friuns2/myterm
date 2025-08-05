// File browser module

let currentPath = '';
let currentFile = null;
let isEditorOpen = false;

// Function to toggle file browser
function toggleFileBrowser() {
    const fileBrowser = document.getElementById('file-browser');
    const terminal = document.getElementById('terminal-container');
    
    if (fileBrowser.classList.contains('hidden')) {
        fileBrowser.classList.remove('hidden');
        terminal.classList.add('lg:w-2/3');
        terminal.classList.remove('w-full');
        
        // Load root directory when opening
        loadDirectory('/');
    } else {
        closeFileBrowser();
    }
}

// Function to close file browser
function closeFileBrowser() {
    const fileBrowser = document.getElementById('file-browser');
    const terminal = document.getElementById('terminal-container');
    
    fileBrowser.classList.add('hidden');
    terminal.classList.remove('lg:w-2/3');
    terminal.classList.add('w-full');
    
    // Resize terminal when file browser is closed
    setTimeout(() => {
        window.Terminal.handleResize();
    }, 100);
}

// Function to load directory
async function loadDirectory(path) {
    const currentProject = window.WebSocketManager.getCurrentProject();
    if (!currentProject) {
        console.error('No current project set');
        return;
    }
    
    try {
        const response = await fetch(`/api/projects/${currentProject}/files?path=${encodeURIComponent(path)}`);
        const data = await response.json();
        
        if (data.success) {
            currentPath = path;
            displayDirectoryContents(data.files, path);
        } else {
            console.error('Failed to load directory:', data.message);
        }
    } catch (error) {
        console.error('Error loading directory:', error);
    }
}

// Function to display directory contents
function displayDirectoryContents(files, path) {
    const fileList = document.getElementById('file-list');
    const currentPathElement = document.getElementById('current-path-browser');
    
    currentPathElement.textContent = path || '/';
    
    let html = '';
    
    // Add parent directory link if not at root
    if (path && path !== '/') {
        const parentPath = path.split('/').slice(0, -1).join('/') || '/';
        html += `
            <div class="file-item flex items-center p-2 hover:bg-gray-700 cursor-pointer" 
                 onclick="window.FileBrowser.loadDirectory('${parentPath}')">
                <span class="mr-2">📁</span>
                <span>..</span>
            </div>
        `;
    }
    
    // Add files and directories
    files.forEach(file => {
        html += createFileItem(file, path);
    });
    
    fileList.innerHTML = html;
}

// Function to create file item
function createFileItem(file, currentPath) {
    const isDirectory = file.type === 'directory';
    const icon = isDirectory ? '📁' : '📄';
    const fullPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
    
    const clickHandler = isDirectory 
        ? `window.FileBrowser.loadDirectory('${fullPath}')`
        : `window.FileBrowser.openFileInEditor('${fullPath}')`;
    
    return `
        <div class="file-item flex items-center p-2 hover:bg-gray-700 cursor-pointer" 
             onclick="${clickHandler}">
            <span class="mr-2">${icon}</span>
            <span class="flex-1">${file.name}</span>
            <span class="text-xs text-gray-400">${file.size || ''}</span>
        </div>
    `;
}

// Function to open file in editor
async function openFileInEditor(filePath) {
    const currentProject = window.WebSocketManager.getCurrentProject();
    if (!currentProject) {
        console.error('No current project set');
        return;
    }
    
    try {
        const response = await fetch(`/api/projects/${currentProject}/files/content?path=${encodeURIComponent(filePath)}`);
        const data = await response.json();
        
        if (data.success) {
            currentFile = filePath;
            isEditorOpen = true;
            
            const fileEditor = document.getElementById('file-editor');
            const fileContent = document.getElementById('file-content');
            const currentFileName = document.getElementById('current-file-name');
            
            fileEditor.classList.remove('hidden');
            currentFileName.textContent = filePath;
            fileContent.value = data.content;
            
            // Adjust layout
            const fileBrowser = document.getElementById('file-browser');
            fileBrowser.classList.add('lg:w-1/3');
            fileBrowser.classList.remove('lg:w-1/2');
            
            const terminal = document.getElementById('terminal-container');
            terminal.classList.add('lg:w-1/3');
            terminal.classList.remove('lg:w-2/3');
            
            // Resize terminal
            setTimeout(() => {
                window.Terminal.handleResize();
            }, 100);
        } else {
            console.error('Failed to load file:', data.message);
        }
    } catch (error) {
        console.error('Error loading file:', error);
    }
}

// Function to save current file
async function saveCurrentFile() {
    if (!currentFile) {
        console.error('No file currently open');
        return;
    }
    
    const currentProject = window.WebSocketManager.getCurrentProject();
    if (!currentProject) {
        console.error('No current project set');
        return;
    }
    
    const fileContent = document.getElementById('file-content');
    const content = fileContent.value;
    
    try {
        const response = await fetch(`/api/projects/${currentProject}/files/content`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: currentFile,
                content: content
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Show success indicator
            const saveBtn = document.querySelector('[onclick="window.FileBrowser.saveCurrentFile()"]');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saved!';
            saveBtn.classList.add('bg-green-600');
            saveBtn.classList.remove('bg-blue-600');
            
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.classList.remove('bg-green-600');
                saveBtn.classList.add('bg-blue-600');
            }, 2000);
        } else {
            console.error('Failed to save file:', data.message);
            alert('Failed to save file: ' + data.message);
        }
    } catch (error) {
        console.error('Error saving file:', error);
        alert('Error saving file');
    }
}

// Function to close file editor
function closeFileEditor() {
    const fileEditor = document.getElementById('file-editor');
    fileEditor.classList.add('hidden');
    
    currentFile = null;
    isEditorOpen = false;
    
    // Restore layout
    const fileBrowser = document.getElementById('file-browser');
    fileBrowser.classList.remove('lg:w-1/3');
    fileBrowser.classList.add('lg:w-1/2');
    
    const terminal = document.getElementById('terminal-container');
    terminal.classList.remove('lg:w-1/3');
    terminal.classList.add('lg:w-2/3');
    
    // Resize terminal
    setTimeout(() => {
        window.Terminal.handleResize();
    }, 100);
}

// Function to create new file
async function createNewFile() {
    const fileName = prompt('Enter file name:');
    if (fileName) {
        await handleFileCreation(fileName);
    }
}

// Function to create new folder
async function createNewFolder() {
    const folderName = prompt('Enter folder name:');
    if (folderName) {
        await handleFolderCreation(folderName);
    }
}

// Function to handle file creation
async function handleFileCreation(fileName) {
    const currentProject = window.WebSocketManager.getCurrentProject();
    if (!currentProject) {
        console.error('No current project set');
        return;
    }
    
    const filePath = currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`;
    
    try {
        const response = await fetch(`/api/projects/${currentProject}/files`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: filePath,
                type: 'file'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Refresh directory listing
            loadDirectory(currentPath);
        } else {
            console.error('Failed to create file:', data.message);
            alert('Failed to create file: ' + data.message);
        }
    } catch (error) {
        console.error('Error creating file:', error);
        alert('Error creating file');
    }
}

// Function to handle folder creation
async function handleFolderCreation(folderName) {
    const currentProject = window.WebSocketManager.getCurrentProject();
    if (!currentProject) {
        console.error('No current project set');
        return;
    }
    
    const folderPath = currentPath === '/' ? `/${folderName}` : `${currentPath}/${folderName}`;
    
    try {
        const response = await fetch(`/api/projects/${currentProject}/files`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: folderPath,
                type: 'directory'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Refresh directory listing
            loadDirectory(currentPath);
        } else {
            console.error('Failed to create folder:', data.message);
            alert('Failed to create folder: ' + data.message);
        }
    } catch (error) {
        console.error('Error creating folder:', error);
        alert('Error creating folder');
    }
}

// Export file browser functions
window.FileBrowser = {
    toggleFileBrowser,
    closeFileBrowser,
    loadDirectory,
    displayDirectoryContents,
    createFileItem,
    openFileInEditor,
    saveCurrentFile,
    closeFileEditor,
    createNewFile,
    createNewFolder,
    handleFileCreation,
    handleFolderCreation
};