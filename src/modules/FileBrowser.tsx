import { signal, effect } from '@preact/signals';
import { isFileBrowserOpenSignal, currentBrowserPathSignal, isFileEditorOpenSignal, currentEditingFileSignal, currentProjectSignal } from './state';
import { useEffect } from 'preact/hooks';

type DirItem = { name: string; type: 'file' | 'directory'; path: string };
type DirData = { currentPath: string; parentPath?: string; items: DirItem[] };

const itemsSignal = signal<DirItem[]>([]);

async function loadDirectory(path: string) {
  const res = await fetch(`/api/browse?path=${encodeURIComponent(path)}`);
  const data: DirData = await res.json();
  currentBrowserPathSignal.value = data.currentPath;
  itemsSignal.value = [
    ...(data.parentPath && data.parentPath !== data.currentPath ? [{ name: '..', type: 'directory', path: data.parentPath }] : []),
    ...data.items
  ];
}

async function openFile(path: string) {
  const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
  const data = await res.json();
  currentEditingFileSignal.value = data.path;
  isFileEditorOpenSignal.value = true;
  fileContentSignal.value = data.content;
}

export const fileContentSignal = signal('');

export function FileBrowser() {
  const close = () => { isFileBrowserOpenSignal.value = false; };

  // When opened, load initial directory
  useEffect(() => {
    const stop = effect(() => {
      if (isFileBrowserOpenSignal.value) {
        const proj = currentProjectSignal.value;
        const initial = currentBrowserPathSignal.value || (proj ? `../projects/${proj}` : '~');
        loadDirectory(initial);
      }
    });
    return () => { stop(); };
  }, []);

  return (
    <div class={`w-80 bg-base-200 border-l border-base-300 ${isFileBrowserOpenSignal.value ? 'flex' : 'hidden'} flex-col`}> 
      <div class="p-3 border-b border-base-300">
        <div class="flex items-center justify-between mb-2">
          <button class="btn btn-xs btn-outline" onClick={close}>← Back to Console</button>
          <h3 class="font-semibold">File Browser</h3>
        </div>
        <div class="flex gap-1">
          <input class="input input-xs flex-1" value={currentBrowserPathSignal.value ?? ''} readOnly />
          <button class="btn btn-xs btn-primary" onClick={() => {/* open modal create file - optional */}}>+ File</button>
          <button class="btn btn-xs btn-secondary" onClick={() => {/* open modal create folder - optional */}}>+ Folder</button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-2">
        {itemsSignal.value.map(item => (
          <div class="file-item p-2 rounded cursor-pointer flex items-center gap-2 text-sm" onClick={() => item.type === 'directory' ? loadDirectory(item.path) : openFile(item.path)}>
            <span class="text-lg">{item.type === 'directory' ? '📁' : '📄'}</span>
            <span class="flex-1 truncate" title={item.name}>{item.name.length > 25 ? item.name.substring(0, 22) + '...' : item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


