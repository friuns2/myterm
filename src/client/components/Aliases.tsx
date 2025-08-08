import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';

export function Aliases() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('Loaded');

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/aliases');
      const data = await res.json();
      setText(data.text || '');
      setStatus('Loaded');
    })();
  }, []);

  const save = async () => {
    setStatus('Saving...');
    const response = await fetch('/api/aliases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (response.ok) {
      const result = await response.json();
      setStatus(`Saved (${result.aliasCount || 0} aliases)`);
      setTimeout(() => setStatus(''), 3000);
    } else {
      setStatus('Save failed');
    }
  };

  const clearAll = async () => {
    if (confirm('Are you sure you want to clear all aliases? This will remove all MyShell24-managed aliases from your .zshrc file.')) {
      setText('');
      await save();
    }
  };

  return (
    <div class="p-6 max-w-4xl mx-auto h-full flex flex-col">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-3xl font-bold">Shell Aliases Manager</h1>
        <div class="flex gap-2">
          <span class="text-sm opacity-70">{status}</span>
          <button class="btn btn-outline" onClick={() => (window as any).showSessionsAndProjectsList?.()}>← Back to Dashboard</button>
        </div>
      </div>
      <div class="bg-base-200 rounded-lg p-4 mb-6">
        <p class="text-sm opacity-70 mb-2">Create and manage zsh shell aliases. Aliases are stored in your ~/.zshrc file.</p>
        <p class="text-xs opacity-50">Format: alias name='command' or just name=command</p>
      </div>
      <div class="bg-base-100 rounded-lg border border-base-300 flex-1 flex flex-col">
        <div class="flex items-center justify-between p-4 border-b border-base-300">
          <h2 class="text-xl font-semibold">Shell Aliases</h2>
          <div class="flex gap-2">
            <button class="btn btn-error btn-sm" onClick={() => void clearAll()}>Clear All</button>
            <button class="btn btn-primary btn-sm" onClick={() => void save()}>Save Now</button>
          </div>
        </div>
        <div class="flex-1 p-4">
          <textarea class="textarea textarea-bordered w-full h-full resize-none font-mono text-sm" value={text} onInput={(e: any) => setText(e.currentTarget.value)} spellcheck={false} />
        </div>
      </div>
    </div>
  );
}


