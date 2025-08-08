import { html, render } from 'uhtml';

let autoSaveTimeout: number | null = null;
let hasUnsavedChanges = false;

export async function showEnvironmentManager(): Promise<void> {
  try {
    const response = await fetch('/api/environment');
    const data = await response.json();
    const terminalContainer = document.getElementById('terminal-container');
    if (!terminalContainer) return;

    let saveStatus = 'Loaded';
    let textValue: string = data.text || '';

    const setStatus = (status: string) => {
      saveStatus = status;
      update();
      if (status.includes('Saved') || status.includes('failed') || status.includes('error')) {
        setTimeout(() => {
          if (saveStatus === status) {
            saveStatus = '';
            update();
          }
        }, 3000);
      }
    };

    const saveEnvironmentVariables = async () => {
      try {
        setStatus('Saving...');
        const response = await fetch('/api/environment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textValue })
        });
        if (response.ok) {
          const result = await response.json();
          hasUnsavedChanges = false;
          setStatus(`Saved (${Object.keys(result.variables).length} variables)`);
          if (autoSaveTimeout) {
            window.clearTimeout(autoSaveTimeout);
            autoSaveTimeout = null;
          }
        } else {
          const error = await response.json();
          console.error('Failed to save environment variables:', error);
          setStatus('Save failed');
        }
      } catch (e) {
        console.error('Error saving environment variables:', e);
        setStatus('Save error');
      }
    };

    const onInput = (e: Event) => {
      const target = e.target as HTMLTextAreaElement;
      textValue = target.value;
      hasUnsavedChanges = true;
      setStatus('Unsaved changes...');
      if (autoSaveTimeout) window.clearTimeout(autoSaveTimeout);
      autoSaveTimeout = window.setTimeout(async () => {
        await saveEnvironmentVariables();
      }, 2000);
    };

    const onClearAll = async () => {
      if (confirm('Are you sure you want to clear all environment variables?')) {
        textValue = '';
        hasUnsavedChanges = true;
        update();
        await saveEnvironmentVariables();
      }
    };

    const onBack = async () => {
      if (hasUnsavedChanges) await saveEnvironmentVariables();
      (window as any).showSessionsAndProjectsList?.();
    };

    const statusClass = () => {
      const base = 'text-sm transition-colors duration-200 ';
      if (saveStatus.includes('Saved')) return base + 'text-success';
      if (saveStatus.includes('Saving')) return base + 'text-warning';
      if (saveStatus.includes('failed') || saveStatus.includes('error')) return base + 'text-error';
      return base + 'opacity-70';
    };

    const view = () => html`<div class="p-6 max-w-4xl mx-auto h-full flex flex-col">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-3xl font-bold">Global Environment Variables</h1>
        <div class="flex gap-2">
          <span class=${statusClass()}>${saveStatus}</span>
          <button class="btn btn-outline" onclick=${onBack}>← Back to Dashboard</button>
        </div>
      </div>
      <div class="bg-base-200 rounded-lg p-4 mb-6">
        <p class="text-sm opacity-70 mb-2">Edit environment variables in KEY=VALUE format. Comments starting with # are ignored. These variables will be available in all new terminal sessions across all projects. Changes are automatically saved as you type.</p>
        <p class="text-xs opacity-50">Example: NODE_ENV=production</p>
      </div>
      <div class="bg-base-100 rounded-lg border border-base-300 flex-1 flex flex-col">
        <div class="flex items-center justify-between p-4 border-b border-base-300">
          <h2 class="text-xl font-semibold">Environment Variables</h2>
          <div class="flex gap-2">
            <button class="btn btn-error btn-sm" onclick=${onClearAll}>Clear All</button>
            <button class="btn btn-primary btn-sm" onclick=${saveEnvironmentVariables}>Save Now</button>
          </div>
        </div>
        <div class="flex-1 p-4">
          <textarea class="textarea textarea-bordered w-full h-full resize-none font-mono text-sm" placeholder="# Add your environment variables here\n# Format: KEY=VALUE\n# Example:\nNODE_ENV=production\nAPI_URL=https://api.example.com\nDEBUG=true" spellcheck="false" oninput=${onInput}>${textValue}</textarea>
        </div>
      </div>
    </div>`;

    const update = () => render(terminalContainer, view());
    update();

    window.addEventListener('beforeunload', async () => {
      if (hasUnsavedChanges) await saveEnvironmentVariables();
    });
  } catch (error) {
    console.error('Error loading environment variables:', error);
    alert('Failed to load environment variables');
  }
}


