import { currentBrowserPath, currentEditingFile, currentProject, isFileBrowserOpen, isFileEditorOpen } from './state';

type DirectoryItem = { name: string; type: 'directory' | 'file'; path: string };
type BrowseResponse = {
  currentPath: string;
  parentPath: string;
  items: DirectoryItem[];
};

export async function toggleFileBrowser(): Promise<void> {
  const fileBrowser = document.getElementById('file-browser');
  if (!fileBrowser) return;
  if (isFileBrowserOpen.value) {
    fileBrowser.classList.add('hidden');
    fileBrowser.classList.remove('flex', 'fullscreen');
    isFileBrowserOpen.value = false;
  } else {
    fileBrowser.classList.remove('hidden');
    fileBrowser.classList.add('flex', 'fullscreen');
    isFileBrowserOpen.value = true;
    const initialPath = currentProject.value ? `../projects/${currentProject.value}` : '~';
    await loadDirectory(initialPath);
  }
}

export async function loadDirectory(dirPath: string): Promise<void> {
  try {
    const response = await fetch(`/api/browse?path=${encodeURIComponent(dirPath)}`);
    const data: BrowseResponse = await response.json();
    if (!response.ok) throw new Error((data as any).error || 'Failed to load directory');
    currentBrowserPath.value = data.currentPath;
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
    currentEditingFile.value = data.path;
    const fileEditor = document.getElementById('file-editor');
    fileEditor?.classList.remove('hidden');
    fileEditor?.classList.add('flex', 'fullscreen');
    isFileEditorOpen.value = true;
    const fileContent = document.getElementById('file-content') as HTMLTextAreaElement | null;
    const editorFilename = document.getElementById('editor-filename');
    if (fileContent) fileContent.value = data.content;
    if (editorFilename) editorFilename.textContent = filePath.split('/').pop() || '';
  } catch (error: any) {
    console.error('Error opening file:', error);
    await (window as any).Swal.fire({ title: 'Error', text: 'Failed to open file: ' + error.message, icon: 'error' });
  }
}

export async function saveCurrentFile(): Promise<void> {
  if (!currentEditingFile.value) {
    await (window as any).Swal.fire({ title: 'Warning', text: 'No file is currently being edited', icon: 'warning' });
    return;
  }
  try {
    const fileContent = document.getElementById('file-content') as HTMLTextAreaElement | null;
    const content = fileContent?.value || '';
    const response = await fetch('/api/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentEditingFile.value, content })
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
  isFileEditorOpen.value = false;
  currentEditingFile.value = null;
}

export function closeFileBrowser(): void {
  const fileBrowser = document.getElementById('file-browser');
  fileBrowser?.classList.add('hidden');
  fileBrowser?.classList.remove('flex', 'fullscreen');
  isFileBrowserOpen.value = false;
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
  if (!currentBrowserPath.value) {
    await (window as any).Swal.fire({ title: 'Warning', text: 'No directory selected', icon: 'warning' });
    return;
  }
  const filePath = `${currentBrowserPath.value}/${fileName}`;
  try {
    const response = await fetch('/api/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content: '' })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to create file');
    await loadDirectory(currentBrowserPath.value);
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
  if (!currentBrowserPath.value) {
    await (window as any).Swal.fire({ title: 'Warning', text: 'No directory selected', icon: 'warning' });
    return;
  }
  const folderPath = `${currentBrowserPath.value}/${folderName}`;
  try {
    const response = await fetch('/api/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folderPath })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to create folder');
    await loadDirectory(currentBrowserPath.value);
    (document.getElementById('new-folder-modal') as HTMLDialogElement | null)?.close();
  } catch (error: any) {
    console.error('Error creating folder:', error);
    await (window as any).Swal.fire({ title: 'Error', text: 'Failed to create folder: ' + error.message, icon: 'error' });
  }
}


