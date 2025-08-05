// File editor module

// File editor state
let currentEditingFile = null;
let isFileEditorOpen = false;

async function openFileInEditor(filePath) {
    try {
        const response = await fetch(`/api/files/content?path=${encodeURIComponent(filePath)}`);
        const data = await response.json();
        
        if (response.ok) {
            currentEditingFile = filePath;
            
            const fileEditor = document.getElementById('file-editor');
            if (!fileEditor) return;
            
            fileEditor.classList.remove('hidden');
            isFileEditorOpen = true;
            
            // Update editor UI
            const fileNameSpan = document.getElementById('editor-filename');
            const fileContentTextarea = document.getElementById('file-content');
            
            if (fileNameSpan) {
                fileNameSpan.textContent = filePath.split('/').pop();
            }
            
            if (fileContentTextarea) {
                fileContentTextarea.value = data.content;
                fileContentTextarea.focus();
            }
        } else {
            alert(data.error || 'Error loading file');
        }
    } catch (error) {
        console.error('Error opening file:', error);
        alert('Error opening file');
    }
}

async function saveCurrentFile() {
    if (!currentEditingFile) {
        alert('No file is currently being edited');
        return;
    }
    
    const fileContentTextarea = document.getElementById('file-content');
    if (!fileContentTextarea) {
        alert('File content not found');
        return;
    }
    
    const content = fileContentTextarea.value;
    
    try {
        const response = await fetch('/api/files/content', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: currentEditingFile,
                content: content
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Show success feedback
            const saveBtn = document.getElementById('save-file');
            if (saveBtn) {
                const originalText = saveBtn.textContent;
                saveBtn.textContent = 'Saved!';
                saveBtn.classList.add('btn-success');
                setTimeout(() => {
                    saveBtn.textContent = originalText;
                    saveBtn.classList.remove('btn-success');
                }, 1000);
            }
        } else {
            alert(result.error || 'Failed to save file');
        }
    } catch (error) {
        console.error('Error saving file:', error);
        alert('Error saving file');
    }
}

function closeFileEditor() {
    const fileEditor = document.getElementById('file-editor');
    if (fileEditor) {
        fileEditor.classList.add('hidden');
    }
    isFileEditorOpen = false;
    currentEditingFile = null;
}

// Export functions for use in other modules
window.fileEditor = {
    openFileInEditor,
    saveCurrentFile,
    closeFileEditor,
    getCurrentFile: () => currentEditingFile,
    isOpen: () => isFileEditorOpen
};

// Make functions globally available for onclick handlers
window.openFileInEditor = openFileInEditor;
window.saveCurrentFile = saveCurrentFile;
window.closeFileEditor = closeFileEditor;