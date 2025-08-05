// File browser module
class FileBrowser {
    constructor() {
        this.isVisible = false;
        this.currentProject = null;
        this.currentPath = '';
        this.isEditorOpen = false;
        this.currentFile = null;
    }

    // Show file browser
    async show(projectName, path = '') {
        this.currentProject = projectName;
        this.currentPath = path;
        this.isVisible = true;
        
        try {
            const items = await window.apiClient.browseDirectory(projectName, path);
            this.render(items);
        } catch (error) {
            console.error('Failed to load directory:', error);
            window.uiManager.showError('Failed to load directory');
        }
    }

    // Hide file browser
    hide() {
        const browser = document.getElementById('file-browser');
        if (browser) {
            browser.remove();
        }
        this.isVisible = false;
        this.closeEditor();
    }

    // Render file browser HTML
    render(items) {
        // Remove existing browser if any
        this.hide();
        
        const browser = document.createElement('div');
        browser.id = 'file-browser';
        browser.className = 'fixed inset-0 bg-black bg-opacity-75 flex z-40';
        
        browser.innerHTML = `
            <div class="w-1/3 bg-gray-900 border-r border-gray-700 flex flex-col">
                <!-- File Browser Header -->
                <div class="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h3 class="text-lg font-semibold text-green-400">File Browser</h3>
                    <button id="close-browser" class="text-gray-400 hover:text-white">
                        ✕
                    </button>
                </div>
                
                <!-- Path Navigation -->
                <div class="p-3 border-b border-gray-700">
                    <div class="flex items-center space-x-2 text-sm">
                        <button id="path-root" class="text-blue-400 hover:text-blue-300">${this.currentProject}</button>
                        ${this.currentPath ? this.renderPathBreadcrumbs() : ''}
                    </div>
                    <div class="mt-2 flex space-x-2">
                        <button id="new-file-btn" class="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded">
                            New File
                        </button>
                        <button id="new-folder-btn" class="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded">
                            New Folder
                        </button>
                    </div>
                </div>
                
                <!-- File List -->
                <div class="flex-1 overflow-y-auto p-2">
                    ${this.renderFileList(items)}
                </div>
            </div>
            
            <!-- Editor Panel -->
            <div id="editor-panel" class="flex-1 bg-gray-800 flex flex-col" style="display: none;">
                <div class="p-4 border-b border-gray-700 flex justify-between items-center">
                    <span id="editor-filename" class="text-green-400 font-medium"></span>
                    <div class="space-x-2">
                        <button id="save-file" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">
                            Save
                        </button>
                        <button id="close-editor" class="text-gray-400 hover:text-white">
                            ✕
                        </button>
                    </div>
                </div>
                <textarea id="file-editor" class="flex-1 p-4 bg-gray-900 text-white font-mono text-sm resize-none outline-none"></textarea>
            </div>
        `;
        
        document.body.appendChild(browser);
        this.setupEvents();
    }

    // Render path breadcrumbs
    renderPathBreadcrumbs() {
        const parts = this.currentPath.split('/').filter(part => part);
        let breadcrumbs = '';
        let currentPath = '';
        
        parts.forEach((part, index) => {
            currentPath += '/' + part;
            breadcrumbs += `
                <span class="text-gray-400">/</span>
                <button class="path-part text-blue-400 hover:text-blue-300" data-path="${currentPath}">
                    ${part}
                </button>
            `;
        });
        
        return breadcrumbs;
    }

    // Render file list
    renderFileList(items) {
        if (!items || items.length === 0) {
            return '<p class="text-gray-400 text-sm p-2">Empty directory</p>';
        }
        
        // Sort items: directories first, then files
        const sortedItems = items.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });
        
        return sortedItems.map(item => {
            const icon = item.isDirectory ? '📁' : '📄';
            const itemClass = item.isDirectory ? 'directory-item' : 'file-item';
            
            return `
                <div class="${itemClass} flex items-center p-2 hover:bg-gray-700 cursor-pointer rounded" data-name="${item.name}" data-is-directory="${item.isDirectory}">
                    <span class="mr-2">${icon}</span>
                    <span class="text-sm ${item.isDirectory ? 'text-blue-400' : 'text-gray-300'}">${item.name}</span>
                    ${item.size ? `<span class="ml-auto text-xs text-gray-500">${window.Utils.formatFileSize(item.size)}</span>` : ''}
                </div>
            `;
        }).join('');
    }

    // Setup event listeners
    setupEvents() {
        // Close browser
        document.getElementById('close-browser')?.addEventListener('click', () => {
            this.hide();
        });

        // Path navigation
        document.getElementById('path-root')?.addEventListener('click', () => {
            this.show(this.currentProject, '');
        });

        document.querySelectorAll('.path-part').forEach(btn => {
            btn.addEventListener('click', () => {
                const path = btn.dataset.path;
                this.show(this.currentProject, path);
            });
        });

        // File/directory items
        document.querySelectorAll('.directory-item').forEach(item => {
            item.addEventListener('click', () => {
                const name = item.dataset.name;
                const newPath = this.currentPath ? `${this.currentPath}/${name}` : name;
                this.show(this.currentProject, newPath);
            });
        });

        document.querySelectorAll('.file-item').forEach(item => {
            item.addEventListener('click', () => {
                const name = item.dataset.name;
                const filePath = this.currentPath ? `${this.currentPath}/${name}` : name;
                this.openFile(filePath);
            });
        });

        // New file/folder buttons
        document.getElementById('new-file-btn')?.addEventListener('click', () => {
            this.showNewFileModal();
        });

        document.getElementById('new-folder-btn')?.addEventListener('click', () => {
            this.showNewFolderModal();
        });

        // Editor events
        document.getElementById('save-file')?.addEventListener('click', () => {
            this.saveCurrentFile();
        });

        document.getElementById('close-editor')?.addEventListener('click', () => {
            this.closeEditor();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.isVisible && e.ctrlKey || e.metaKey) {
                if (e.key === 's' && this.isEditorOpen) {
                    e.preventDefault();
                    this.saveCurrentFile();
                }
            }
        });
    }

    // Open file in editor
    async openFile(filePath) {
        try {
            const content = await window.apiClient.readFile(this.currentProject, filePath);
            this.currentFile = filePath;
            this.isEditorOpen = true;
            
            const editorPanel = document.getElementById('editor-panel');
            const filenameSpan = document.getElementById('editor-filename');
            const editor = document.getElementById('file-editor');
            
            if (editorPanel && filenameSpan && editor) {
                editorPanel.style.display = 'flex';
                filenameSpan.textContent = filePath;
                editor.value = content;
                editor.focus();
            }
        } catch (error) {
            console.error('Failed to open file:', error);
            window.uiManager.showError('Failed to open file');
        }
    }

    // Save current file
    async saveCurrentFile() {
        if (!this.currentFile) return;
        
        const editor = document.getElementById('file-editor');
        if (!editor) return;
        
        try {
            await window.apiClient.saveFile(this.currentProject, this.currentFile, editor.value);
            window.uiManager.showSuccess('File saved successfully');
        } catch (error) {
            console.error('Failed to save file:', error);
            window.uiManager.showError('Failed to save file');
        }
    }

    // Close editor
    closeEditor() {
        const editorPanel = document.getElementById('editor-panel');
        if (editorPanel) {
            editorPanel.style.display = 'none';
        }
        this.isEditorOpen = false;
        this.currentFile = null;
    }

    // Show new file modal
    showNewFileModal() {
        const currentPath = this.currentPath;
        window.uiManager.showModal('Create New File', `
            <input type="text" id="new-file-name" placeholder="File name" class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white">
            <p class="text-sm text-gray-400 mt-2">Path: ${currentPath || '/'}</p>
        `, async () => {
            const fileName = document.getElementById('new-file-name').value.trim();
            if (fileName) {
                const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
                try {
                    await window.apiClient.saveFile(this.currentProject, filePath, '');
                    window.uiManager.hideModal();
                    this.show(this.currentProject, currentPath); // Refresh
                    window.uiManager.showSuccess('File created successfully');
                } catch (error) {
                    window.uiManager.showError('Failed to create file');
                }
            }
        });
    }

    // Show new folder modal
    showNewFolderModal() {
        const currentPath = this.currentPath;
        window.uiManager.showModal('Create New Folder', `
            <input type="text" id="new-folder-name" placeholder="Folder name" class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white">
            <p class="text-sm text-gray-400 mt-2">Path: ${currentPath || '/'}</p>
        `, async () => {
            const folderName = document.getElementById('new-folder-name').value.trim();
            if (folderName) {
                const folderPath = currentPath ? `${currentPath}/${folderName}` : folderName;
                try {
                    await window.apiClient.createFolder(this.currentProject, folderPath);
                    window.uiManager.hideModal();
                    this.show(this.currentProject, currentPath); // Refresh
                    window.uiManager.showSuccess('Folder created successfully');
                } catch (error) {
                    window.uiManager.showError('Failed to create folder');
                }
            }
        });
    }

    // Check if browser is visible
    isOpen() {
        return this.isVisible;
    }

    // Get current project
    getCurrentProject() {
        return this.currentProject;
    }

    // Get current path
    getCurrentPath() {
        return this.currentPath;
    }
}

// Create global instance
window.fileBrowser = new FileBrowser();