import { html, render } from 'uhtml';

let aliasAutoSaveTimeout: number | null = null;
let aliasHasUnsavedChanges = false;

export async function showAliasesManager(): Promise<void> {
  try {
    const response = await fetch('/api/aliases');
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

    const saveAliases = async () => {
      try {
        setStatus('Saving...');
        const response = await fetch('/api/aliases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textValue })
        });
        if (response.ok) {
          const result = await response.json();
          aliasHasUnsavedChanges = false;
          setStatus(`Saved (${result.aliasCount || 0} aliases)`);
          if (aliasAutoSaveTimeout) {
            window.clearTimeout(aliasAutoSaveTimeout);
            aliasAutoSaveTimeout = null;
          }
        } else {
          const error = await response.json();
          console.error('Failed to save aliases:', error);
          setStatus('Save failed');
          if (error.details && error.details.length > 0) alert('Save failed:\n' + error.details.join('\n'));
        }
      } catch (e) {
        console.error('Error saving aliases:', e);
        setStatus('Save error');
      }
    };

    const onInput = (e: Event) => {
      const target = e.target as HTMLTextAreaElement;
      textValue = target.value;
      aliasHasUnsavedChanges = true;
      setStatus('Unsaved changes...');
      if (aliasAutoSaveTimeout) window.clearTimeout(aliasAutoSaveTimeout);
      aliasAutoSaveTimeout = window.setTimeout(async () => {
        await saveAliases();
      }, 2000);
    };

    const onClearAll = async () => {
      if (confirm('Are you sure you want to clear all aliases? This will remove all MyShell24-managed aliases from your .zshrc file.')) {
        textValue = '';
        aliasHasUnsavedChanges = true;
        update();
        await saveAliases();
      }
    };

    const onBack = async () => {
      if (aliasHasUnsavedChanges) await saveAliases();
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
        <h1 class="text-3xl font-bold">Shell Aliases Manager</h1>
        <div class="flex gap-2">
          <span class=${statusClass()}>${saveStatus}</span>
          <button class="btn btn-outline" onclick=${onBack}>← Back to Dashboard</button>
        </div>
      </div>
      <div class="bg-base-200 rounded-lg p-4 mb-6">
        <p class="text-sm opacity-70 mb-2">Create and manage zsh shell aliases. Aliases are stored in your ~/.zshrc file. Use the format: <code>alias name='command'</code> or just <code>name=command</code> (auto-formatted). Changes are automatically saved and will be available in new terminal sessions.</p>
        <p class="text-xs opacity-50 mb-2">Examples:<br>• <code>alias ll='ls -la'</code><br>• <code>alias gs='git status'</code><br>• <code>alias ..='cd ..'</code></p>
        <div class="text-xs opacity-50">
          <strong>Location:</strong> ${data.zshrcPath || '~/.zshrc'}
          ${data.hasZshrc ? html`<span class="text-success">✓ Found</span>` : html`<span class="text-warning">⚠ Will be created</span>`}
        </div>
      </div>
      <div class="bg-base-100 rounded-lg border border-base-300 flex-1 flex flex-col">
        <div class="flex items-center justify-between p-4 border-b border-base-300">
          <h2 class="text-xl font-semibold">Shell Aliases</h2>
          <div class="flex gap-2">
            <button class="btn btn-error btn-sm" onclick=${onClearAll}>Clear All</button>
            <button class="btn btn-primary btn-sm" onclick=${saveAliases}>Save Now</button>
          </div>
        </div>
        <div class="flex-1 p-4">
          <textarea class="textarea textarea-bordered w-full h-full resize-none font-mono text-sm" placeholder="# Add your shell aliases here\n# Format: alias name='command' or just name=command\n# Examples:\nalias ll='ls -la'\nalias gs='git status'\nalias ..='cd ..'\nalias grep='grep --color=auto'\nalias h='history'\nalias c='clear'" spellcheck="false" oninput=${onInput}>${textValue}</textarea>
        </div>
      </div>
    </div>`;

    const update = () => render(terminalContainer, view());
    update();

    window.addEventListener('beforeunload', async () => {
      if (aliasHasUnsavedChanges) await saveAliases();
    });
  } catch (error) {
    console.error('Error loading aliases:', error);
    alert('Failed to load aliases');
  }
}


