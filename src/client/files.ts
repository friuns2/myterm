import { state } from './state';

type DirectoryItem = { name: string; type: 'directory' | 'file'; path: string };
type BrowseResponse = {
  currentPath: string;
  parentPath: string;
  items: DirectoryItem[];
};

export async function toggleFileBrowser(): Promise<void> {
  const fileBrowser = document.getElementById('file-browser');
  if (!fileBrowser) return;
  if (state.isFileBrowserOpen) {
    fileBrowser.classList.add('hidden');
    fileBrowser.classList.remove('flex', 'fullscreen');
    state.isFileBrowserOpen = false;
  } else {
    fileBrowser.classList.remove('hidden');
    fileBrowser.classList.add('flex', 'fullscreen');
    state.isFileBrowserOpen = true;
    const initialPath = state.currentProject ? `../projects/${state.currentProject}` : '~';
    await loadDirectory(initialPath);
  }
}

export async function loadDirectory(dirPath: string): Promise<void> {
  try {
    const response = await fetch(`/api/browse?path=${encodeURIComponent(dirPath)}`);
    const data: BrowseResponse = await response.json();
    if (!response.ok) throw new Error((data as any).error || 'Failed to load directory');
    state.currentBrowserPath = data.currentPath;
    displayDirectoryContents(data);
    const currentDirInput = document.getElementById('current-dir') as HTMLInputElement | null;
    if (currentDirInput) currentDirInput.value = data.currentPath;
  } catch (error: any) {
    console.error('Error loading directory:', error);
    await (window as any).Swal.fire({ title: 'Error', text: 'Failed to load directory: ' + error.message, icon: 'error' });
  }
}

export function displayDirectoryContents(data: BrowseResponse): void {
  const fileList = document.getElementById('file-list');
  if (!fileList) return;
  fileList.innerHTML = '';
  if (data.parentPath && data.parentPath !== data.currentPath) {
    fileList.appendChild(createFileItem({ name: '..', type: 'directory', path: data.parentPath }));
  }
  data.items.forEach((item) => fileList.appendChild(createFileItem(item)));
}

export function createFileItem(item: DirectoryItem): HTMLDivElement {
  const div = document.createElement('div');
  div.className = 'file-item p-2 rounded cursor-pointer flex items-center gap-2 text-sm';
  const icon = item.type === 'directory' ? '📁' : '📄';
  const displayName = item.name.length > 25 ? item.name.substring(0, 22) + '...' : item.name;
  div.innerHTML = `
    <span class="text-lg">${icon}</span>
    <span class="flex-1 truncate" title="${item.name}">${displayName}</span>
  `;
  div.addEventListener('click', () => {
    if (item.type === 'directory') loadDirectory(item.path);
    else void openFileInEditor(item.path);
  });
  return div;
}

export async function openFileInEditor(filePath: string): Promise<void> {
  try {
    const response = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load file');
    state.currentEditingFile = data.path;
    const fileEditor = document.getElementById('file-editor');
    const fileContent = document.getElementById('file-content') as HTMLTextAreaElement | null;
    const editorFilename = document.getElementById('editor-filename');
    fileEditor?.classList.remove('hidden');
    fileEditor?.classList.add('flex', 'fullscreen');
    state.isFileEditorOpen = true;
    if (fileContent) fileContent.value = data.content;
    if (editorFilename) editorFilename.textContent = filePath.split('/').pop() || '';
  } catch (error: any) {
    console.error('Error opening file:', error);
    await (window as any).Swal.fire({ title: 'Error', text: 'Failed to open file: ' + error.message, icon: 'error' });
  }
}

export async function saveCurrentFile(): Promise<void> {
  if (!state.currentEditingFile) {
    await (window as any).Swal.fire({ title: 'Warning', text: 'No file is currently being edited', icon: 'warning' });
    return;
  }
  try {
    const fileContent = document.getElementById('file-content') as HTMLTextAreaElement | null;
    const content = fileContent?.value || '';
    const response = await fetch('/api/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: state.currentEditingFile, content })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to save file');
    const saveButton = document.getElementById('save-file');
    if (saveButton) {
      const originalText = saveButton.textContent || 'Save';
      saveButton.textContent = 'Saved!';
      saveButton.classList.add('btn-success');
      setTimeout(() => {
        saveButton.textContent = originalText;
        saveButton.classList.remove('btn-success');
      }, 1000);
    }
  } catch (error: any) {
    console.error('Error saving file:', error);
    await (window as any).Swal.fire({ title: 'Error', text: 'Failed to save file: ' + error.message, icon: 'error' });
  }
}

export function closeFileEditor(): void {
  const fileEditor = document.getElementById('file-editor');
  fileEditor?.classList.add('hidden');
  fileEditor?.classList.remove('flex', 'fullscreen');
  state.isFileEditorOpen = false;
  state.currentEditingFile = null;
}

export function closeFileBrowser(): void {
  const fileBrowser = document.getElementById('file-browser');
  fileBrowser?.classList.add('hidden');
  fileBrowser?.classList.remove('flex', 'fullscreen');
  state.isFileBrowserOpen = false;
}

export function createNewFile(): void {
  const modal = document.getElementById('new-file-modal') as HTMLDialogElement | null;
  const input = document.getElementById('new-file-name') as HTMLInputElement | null;
  if (!modal || !input) return;
  input.value = '';
  modal.showModal();
  input.focus();
}

export function createNewFolder(): void {
  const modal = document.getElementById('new-folder-modal') as HTMLDialogElement | null;
  const input = document.getElementById('new-folder-name') as HTMLInputElement | null;
  if (!modal || !input) return;
  input.value = '';
  modal.showModal();
  input.focus();
}

export async function handleFileCreation(): Promise<void> {
  const input = document.getElementById('new-file-name') as HTMLInputElement | null;
  const fileName = (input?.value || '').trim();
  if (!fileName) return;
  if (!state.currentBrowserPath) {
    await (window as any).Swal.fire({ title: 'Warning', text: 'No directory selected', icon: 'warning' });
    return;
  }
  const filePath = `${state.currentBrowserPath}/${fileName}`;
  try {
    const response = await fetch('/api/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content: '' })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to create file');
    await loadDirectory(state.currentBrowserPath);
    await openFileInEditor(filePath);
    (document.getElementById('new-file-modal') as HTMLDialogElement | null)?.close();
  } catch (error: any) {
    console.error('Error creating file:', error);
    await (window as any).Swal.fire({ title: 'Error', text: 'Failed to create file: ' + error.message, icon: 'error' });
  }
}

export async function handleFolderCreation(): Promise<void> {
  const input = document.getElementById('new-folder-name') as HTMLInputElement | null;
  const folderName = (input?.value || '').trim();
  if (!folderName) return;
  if (!state.currentBrowserPath) {
    await (window as any).Swal.fire({ title: 'Warning', text: 'No directory selected', icon: 'warning' });
    return;
  }
  const folderPath = `${state.currentBrowserPath}/${folderName}`;
  try {
    const response = await fetch('/api/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folderPath })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to create folder');
    await loadDirectory(state.currentBrowserPath);
    (document.getElementById('new-folder-modal') as HTMLDialogElement | null)?.close();
  } catch (error: any) {
    console.error('Error creating folder:', error);
    await (window as any).Swal.fire({ title: 'Error', text: 'Failed to create folder: ' + error.message, icon: 'error' });
  }
}


