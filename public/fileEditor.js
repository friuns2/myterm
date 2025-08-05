// File editor module

import { getCurrentBrowserPath, loadDirectory } from './fileBrowser.js';

// File editor state
let currentEditingFile = null;
let isFileEditorOpen = false;

/**
 * Open file in editor
 * @param {string} filePath - Path to the file to open
 */
export async function openFileInEditor(filePath) {
    try {
        const response = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to load file');
        }
        
        currentEditingFile = data.path;
        
        // Show editor panel in fullscreen
        const fileEditor = document.getElementById('file-editor');
        if (!fileEditor) {
            console.error('File editor element not found');
            return;
        }
        
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

/**
 * Save current file
 */
export async function saveCurrentFile() {
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
        showSaveSuccessFeedback();
        
    } catch (error) {
        console.error('Error saving file:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Failed to save file: ' + error.message,
            icon: 'error'
        });
    }
}

/**
 * Show save success feedback
 */
function showSaveSuccessFeedback() {
    const saveButton = document.getElementById('save-file');
    if (saveButton) {
        const originalText = saveButton.textContent;
        const originalClasses = saveButton.className;
        
        saveButton.textContent = 'Saved!';
        saveButton.classList.remove('btn-success');
        saveButton.classList.add('btn-info');
        
        setTimeout(() => {
            saveButton.textContent = originalText;
            saveButton.className = originalClasses;
        }, 1500);
    }
}

/**
 * Close file editor
 */
export function closeFileEditor() {
    const fileEditor = document.getElementById('file-editor');
    if (!fileEditor) {
        console.error('File editor element not found');
        return;
    }
    
    fileEditor.classList.add('hidden');
    fileEditor.classList.remove('flex', 'fullscreen');
    isFileEditorOpen = false;
    currentEditingFile = null;
    
    // Clear editor content
    const fileContent = document.getElementById('file-content');
    const editorFilename = document.getElementById('editor-filename');
    
    if (fileContent) {
        fileContent.value = '';
    }
    
    if (editorFilename) {
        editorFilename.textContent = 'Editor';
    }
}

/**
 * Setup file editor keyboard shortcuts
 */
export function setupFileEditorShortcuts() {
    const fileContentTextarea = document.getElementById('file-content');
    if (!fileContentTextarea) {
        console.error('File content textarea not found');
        return;
    }
    
    fileContentTextarea.addEventListener('keydown', (event) => {
        // Ctrl+S or Cmd+S to save
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            saveCurrentFile();
        }
        
        // Tab key handling for proper indentation
        if (event.key === 'Tab') {
            event.preventDefault();
            const start = event.target.selectionStart;
            const end = event.target.selectionEnd;
            const value = event.target.value;
            
            if (event.shiftKey) {
                // Shift+Tab: Remove indentation
                const lines = value.substring(0, start).split('\n');
                const currentLineStart = start - lines[lines.length - 1].length;
                const currentLineEnd = value.indexOf('\n', start);
                const lineEnd = currentLineEnd === -1 ? value.length : currentLineEnd;
                const currentLine = value.substring(currentLineStart, lineEnd);
                
                if (currentLine.startsWith('\t')) {
                    event.target.value = value.substring(0, currentLineStart) + 
                        currentLine.substring(1) + 
                        value.substring(lineEnd);
                    event.target.selectionStart = event.target.selectionEnd = start - 1;
                } else if (currentLine.startsWith('    ')) {
                    event.target.value = value.substring(0, currentLineStart) + 
                        currentLine.substring(4) + 
                        value.substring(lineEnd);
                    event.target.selectionStart = event.target.selectionEnd = start - 4;
                }
            } else {
                // Tab: Insert tab character or spaces
                const tabChar = '\t'; // Could be configurable to use spaces
                event.target.value = value.substring(0, start) + tabChar + value.substring(end);
                event.target.selectionStart = event.target.selectionEnd = start + tabChar.length;
            }
        }
        
        // Auto-indentation on Enter
        if (event.key === 'Enter') {
            const value = event.target.value;
            const start = event.target.selectionStart;
            const lines = value.substring(0, start).split('\n');
            const currentLine = lines[lines.length - 1];
            const indentMatch = currentLine.match(/^(\s*)/);
            const indent = indentMatch ? indentMatch[1] : '';
            
            // Add extra indentation for lines ending with { [ (
            const extraIndent = /[{\[(]\s*$/.test(currentLine.trim()) ? '\t' : '';
            
            setTimeout(() => {
                const newValue = event.target.value;
                const newStart = event.target.selectionStart;
                event.target.value = newValue.substring(0, newStart) + 
                    indent + extraIndent + 
                    newValue.substring(newStart);
                event.target.selectionStart = event.target.selectionEnd = newStart + indent.length + extraIndent.length;
            }, 0);
        }
    });
}

/**
 * Check if file editor is open
 * @returns {boolean} - Editor open status
 */
export function getFileEditorOpenStatus() {
    return isFileEditorOpen;
}

/**
 * Get current editing file
 * @returns {string|null} - Current editing file path
 */
export function getCurrentEditingFile() {
    return currentEditingFile;
} 