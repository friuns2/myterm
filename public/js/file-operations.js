// File operations module

let currentPath = '';
let fileEditor = null;
let currentEditingFile = null;

function showFileBrowser() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const html = `
        <div class="flex h-full">
            <!-- File Browser Panel -->
            <div class="w-1/3 border-r border-base-300 flex flex-col">
                <div class="p-4 border-b border-base-300">
                    <h2 class="text-xl font-semibold mb-2">File Browser</h2>
                    <div class="flex gap-2 mb-2">
                        <button class="btn btn-sm btn-primary" onclick="window.FileModule.createFile()">New File</button>
                        <button class="btn btn-sm btn-secondary" onclick="window.FileModule.createFolder()">New Folder</button>
                    </div>
                    <div class="text-sm text-base-content/70" id="current-path">/</div>
                </div>
                <div class="flex-1 overflow-auto p-4" id="file-list">
                    Loading...
                </div>
            </div>
            
            <!-- File Editor Panel -->
            <div class="flex-1 flex flex-col">
                <div class="p-4 border-b border-base-300 flex justify-between items-center">
                    <h2 class="text-xl font-semibold">File Editor</h2>
                    <div class="flex gap-2">
                        <button class="btn btn-sm btn-success" onclick="window.FileModule.saveFile()" id="save-btn" disabled>Save</button>
                        <button class="btn btn-sm btn-ghost" onclick="window.FileModule.closeFile()" id="close-btn" disabled>Close</button>
                    </div>
                </div>
                <div class="flex-1 p-4">
                    <div id="file-editor-container" class="h-full">
                        <div class="text-center text-base-content/70 mt-20">
                            Select a file to edit
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    mainContent.innerHTML = html;
    window.UIModule.showNavigationBar();
    loadDirectory('/');
}

async function loadDirectory(path) {
    try {
        const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
        const files = await response.json();
        
        currentPath = path;
        document.getElementById('current-path').textContent = path;
        
        const fileList = document.getElementById('file-list');
        let html = '';
        
        // Add parent directory link if not at root
        if (path !== '/') {
            const parentPath = path.split('/').slice(0, -1).join('/') || '/';
            html += `
                <div class="flex items-center p-2 hover:bg-base-200 rounded cursor-pointer" onclick="window.FileModule.loadDirectory('${parentPath}')">
                    <span class="mr-2">📁</span>
                    <span>..</span>
                </div>
            `;
        }
        
        // Sort files: directories first, then files
        files.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });
        
        files.forEach(file => {
            const icon = file.isDirectory ? '📁' : '📄';
            const clickAction = file.isDirectory 
                ? `window.FileModule.loadDirectory('${path === '/' ? '' : path}/${file.name}')`
                : `window.FileModule.openFile('${path === '/' ? '' : path}/${file.name}')`;
            
            html += `
                <div class="flex items-center p-2 hover:bg-base-200 rounded cursor-pointer" onclick="${clickAction}">
                    <span class="mr-2">${icon}</span>
                    <span class="flex-1">${file.name}</span>
                    <span class="text-xs text-base-content/50">${file.isDirectory ? 'DIR' : formatFileSize(file.size)}</span>
                </div>
            `;
        });
        
        fileList.innerHTML = html;
    } catch (error) {
        console.error('Error loading directory:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Failed to load directory',
            icon: 'error'
        });
    }
}

async function openFile(filePath) {
    try {
        const response = await fetch(`/api/files/content?path=${encodeURIComponent(filePath)}`);
        
        if (!response.ok) {
            await Swal.fire({
                title: 'Error',
                text: 'Failed to open file',
                icon: 'error'
            });
            return;
        }
        
        const content = await response.text();
        currentEditingFile = filePath;
        
        // Initialize CodeMirror editor if not already done
        if (!fileEditor) {
            const editorContainer = document.getElementById('file-editor-container');
            editorContainer.innerHTML = '<textarea id="file-editor"></textarea>';
            
            fileEditor = CodeMirror.fromTextArea(document.getElementById('file-editor'), {
                lineNumbers: true,
                mode: getFileMode(filePath),
                theme: 'default',
                indentUnit: 4,
                lineWrapping: true,
                autoCloseBrackets: true,
                matchBrackets: true
            });
            
            fileEditor.on('change', () => {
                document.getElementById('save-btn').disabled = false;
            });
        } else {
            fileEditor.setOption('mode', getFileMode(filePath));
        }
        
        fileEditor.setValue(content);
        document.getElementById('save-btn').disabled = true;
        document.getElementById('close-btn').disabled = false;
        
    } catch (error) {
        console.error('Error opening file:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Error opening file',
            icon: 'error'
        });
    }
}

async function saveFile() {
    if (!currentEditingFile || !fileEditor) {
        await Swal.fire({
            title: 'Warning',
            text: 'No file is being edited',
            icon: 'warning'
        });
        return;
    }
    
    try {
        const content = fileEditor.getValue();
        const response = await fetch('/api/files/content', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: currentEditingFile,
                content: content
            })
        });
        
        if (response.ok) {
            document.getElementById('save-btn').disabled = true;
            // Show success message briefly
            const saveBtn = document.getElementById('save-btn');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saved!';
            setTimeout(() => {
                saveBtn.textContent = originalText;
            }, 1000);
        } else {
            await Swal.fire({
                title: 'Error',
                text: 'Failed to save file',
                icon: 'error'
            });
        }
    } catch (error) {
        console.error('Error saving file:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Error saving file',
            icon: 'error'
        });
    }
}

function closeFile() {
    if (fileEditor) {
        fileEditor.setValue('');
        document.getElementById('save-btn').disabled = true;
        document.getElementById('close-btn').disabled = true;
        currentEditingFile = null;
        
        const editorContainer = document.getElementById('file-editor-container');
        editorContainer.innerHTML = `
            <div class="text-center text-base-content/70 mt-20">
                Select a file to edit
            </div>
        `;
        fileEditor = null;
    }
}

async function createFile() {
    if (!currentPath) {
        await Swal.fire({
            title: 'Warning',
            text: 'No directory selected',
            icon: 'warning'
        });
        return;
    }
    
    const { value: fileName } = await Swal.fire({
        title: 'Create New File',
        input: 'text',
        inputLabel: 'File Name',
        inputPlaceholder: 'Enter file name',
        showCancelButton: true,
        inputValidator: (value) => {
            if (!value) {
                return 'You need to enter a file name!';
            }
        }
    });
    
    if (!fileName) return;
    
    try {
        const filePath = currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`;
        const response = await fetch('/api/files/content', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: filePath,
                content: ''
            })
        });
        
        if (response.ok) {
            loadDirectory(currentPath);
        } else {
            await Swal.fire({
                title: 'Error',
                text: 'Failed to create file',
                icon: 'error'
            });
        }
    } catch (error) {
        console.error('Error creating file:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Error creating file',
            icon: 'error'
        });
    }
}

async function createFolder() {
    if (!currentPath) {
        await Swal.fire({
            title: 'Warning',
            text: 'No directory selected',
            icon: 'warning'
        });
        return;
    }
    
    const { value: folderName } = await Swal.fire({
        title: 'Create New Folder',
        input: 'text',
        inputLabel: 'Folder Name',
        inputPlaceholder: 'Enter folder name',
        showCancelButton: true,
        inputValidator: (value) => {
            if (!value) {
                return 'You need to enter a folder name!';
            }
        }
    });
    
    if (!folderName) return;
    
    try {
        const folderPath = currentPath === '/' ? `/${folderName}` : `${currentPath}/${folderName}`;
        const response = await fetch('/api/files/mkdir', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: folderPath
            })
        });
        
        if (response.ok) {
            loadDirectory(currentPath);
        } else {
            await Swal.fire({
                title: 'Error',
                text: 'Failed to create folder',
                icon: 'error'
            });
        }
    } catch (error) {
        console.error('Error creating folder:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Error creating folder',
            icon: 'error'
        });
    }
}

function getFileMode(filePath) {
    const extension = filePath.split('.').pop().toLowerCase();
    const modeMap = {
        'js': 'javascript',
        'ts': 'javascript',
        'jsx': 'jsx',
        'tsx': 'jsx',
        'py': 'python',
        'html': 'htmlmixed',
        'css': 'css',
        'scss': 'sass',
        'less': 'text/x-less',
        'json': 'application/json',
        'xml': 'xml',
        'md': 'markdown',
        'sh': 'shell',
        'bash': 'shell',
        'zsh': 'shell',
        'sql': 'sql',
        'php': 'php',
        'rb': 'ruby',
        'go': 'go',
        'rs': 'rust',
        'java': 'text/x-java',
        'c': 'text/x-csrc',
        'cpp': 'text/x-c++src',
        'h': 'text/x-csrc',
        'hpp': 'text/x-c++src'
    };
    
    return modeMap[extension] || 'text/plain';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Export functions for use in other modules
window.FileModule = {
    showFileBrowser,
    loadDirectory,
    openFile,
    saveFile,
    closeFile,
    createFile,
    createFolder
};