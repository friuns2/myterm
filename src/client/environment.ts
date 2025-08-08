let autoSaveTimeout: number | null = null;
let hasUnsavedChanges = false;

export async function showEnvironmentManager(): Promise<void> {
  try {
    const response = await fetch('/api/environment');
    const data = await response.json();
    const terminalContainer = document.getElementById('terminal-container');
    if (!terminalContainer) return;
    terminalContainer.innerHTML = `
      <div class="p-6 max-w-4xl mx-auto h-full flex flex-col">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-3xl font-bold">Global Environment Variables</h1>
          <div class="flex gap-2">
            <span id="save-status" class="text-sm opacity-70"></span>
            <button id="back-to-dashboard" class="btn btn-outline">← Back to Dashboard</button>
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
              <button id="clear-all-vars" class="btn btn-error btn-sm">Clear All</button>
              <button id="save-manually" class="btn btn-primary btn-sm">Save Now</button>
            </div>
          </div>
          <div class="flex-1 p-4">
            <textarea id="env-editor" class="textarea textarea-bordered w-full h-full resize-none font-mono text-sm" placeholder="# Add your environment variables here\n# Format: KEY=VALUE\n# Example:\nNODE_ENV=production\nAPI_URL=https://api.example.com\nDEBUG=true" spellcheck="false">${
              data.text || ''
            }</textarea>
          </div>
        </div>
      </div>`;

    setupEnvironmentEventListeners();
    updateSaveStatus('Loaded');
  } catch (error) {
    console.error('Error loading environment variables:', error);
    alert('Failed to load environment variables');
  }
}

function setupEnvironmentEventListeners(): void {
  const backButton = document.getElementById('back-to-dashboard');
  const envEditor = document.getElementById('env-editor') as HTMLTextAreaElement | null;
  const clearAllButton = document.getElementById('clear-all-vars');
  const saveButton = document.getElementById('save-manually');

  backButton?.addEventListener('click', async () => {
    if (hasUnsavedChanges) await saveEnvironmentVariables();
    (window as any).showSessionsAndProjectsList?.();
  });

  envEditor?.addEventListener('input', () => {
    hasUnsavedChanges = true;
    updateSaveStatus('Unsaved changes...');
    if (autoSaveTimeout) window.clearTimeout(autoSaveTimeout);
    autoSaveTimeout = window.setTimeout(async () => {
      await saveEnvironmentVariables();
    }, 2000);
  });

  saveButton?.addEventListener('click', async () => {
    await saveEnvironmentVariables();
  });

  clearAllButton?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all environment variables?')) {
      if (envEditor) envEditor.value = '';
      hasUnsavedChanges = true;
      await saveEnvironmentVariables();
    }
  });

  window.addEventListener('beforeunload', async () => {
    if (hasUnsavedChanges) await saveEnvironmentVariables();
  });
}

async function saveEnvironmentVariables(): Promise<void> {
  try {
    const envEditor = document.getElementById('env-editor') as HTMLTextAreaElement | null;
    const text = envEditor?.value || '';
    updateSaveStatus('Saving...');
    const response = await fetch('/api/environment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (response.ok) {
      const result = await response.json();
      hasUnsavedChanges = false;
      updateSaveStatus(`Saved (${Object.keys(result.variables).length} variables)`);
      if (autoSaveTimeout) {
        window.clearTimeout(autoSaveTimeout);
        autoSaveTimeout = null;
      }
    } else {
      const error = await response.json();
      updateSaveStatus('Save failed');
      console.error('Failed to save environment variables:', error);
    }
  } catch (error) {
    updateSaveStatus('Save error');
    console.error('Error saving environment variables:', error);
  }
}

function updateSaveStatus(status: string): void {
  const saveStatus = document.getElementById('save-status');
  if (!saveStatus) return;
  saveStatus.textContent = status;
  saveStatus.className = 'text-sm transition-colors duration-200';
  if (status.includes('Saved')) saveStatus.className += ' text-success';
  else if (status.includes('Saving')) saveStatus.className += ' text-warning';
  else if (status.includes('failed') || status.includes('error')) saveStatus.className += ' text-error';
  else saveStatus.className += ' opacity-70';
  if (status.includes('Saved') || status.includes('failed') || status.includes('error')) {
    setTimeout(() => {
      if (saveStatus.textContent === status) saveStatus.textContent = '';
    }, 3000);
  }
}


