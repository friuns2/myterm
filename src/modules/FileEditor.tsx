import { currentEditingFileSignal, isFileEditorOpenSignal } from './state';
import { fileContentSignal } from './FileBrowser';

async function saveCurrentFile() {
  if (!currentEditingFileSignal.value) return;
  const res = await fetch('/api/file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: currentEditingFileSignal.value, content: fileContentSignal.value })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    alert('Failed to save file: ' + (err.error || res.statusText));
  }
}

export function FileEditor() {
  const close = () => { isFileEditorOpenSignal.value = false; currentEditingFileSignal.value = null; };
  const filename = currentEditingFileSignal.value ? currentEditingFileSignal.value.split('/').pop() : 'Editor';
  return (
    <div class={`w-96 bg-base-100 border-l border-base-300 ${isFileEditorOpenSignal.value ? 'flex' : 'hidden'} flex-col`}>
      <div class="p-3 border-b border-base-300">
        <div class="flex items-center justify-between mb-2">
          <button class="btn btn-xs btn-outline" onClick={close}>← Back to Console</button>
          <h3 class="font-semibold">{filename}</h3>
          <button class="btn btn-xs btn-success" onClick={saveCurrentFile}>Save</button>
        </div>
      </div>
      <textarea class="flex-1 p-3 bg-base-100 font-mono text-sm resize-none border-none outline-none" value={fileContentSignal.value} onInput={(e) => (fileContentSignal.value = (e.currentTarget as HTMLTextAreaElement).value)} />
    </div>
  );
}


