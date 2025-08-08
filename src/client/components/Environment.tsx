import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';

export function Environment() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('Loaded');

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/environment');
      const data = await res.json();
      setText(data.text || '');
      setStatus('Loaded');
    })();
  }, []);

  const save = async () => {
    setStatus('Saving...');
    const response = await fetch('/api/environment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (response.ok) {
      const result = await response.json();
      setStatus(`Saved (${Object.keys(result.variables).length} variables)`);
      setTimeout(() => setStatus(''), 3000);
    } else {
      setStatus('Save failed');
    }
  };

  const clearAll = async () => {
    if (confirm('Are you sure you want to clear all environment variables?')) {
      setText('');
      await save();
    }
  };

  return (
    <div class="p-6 max-w-4xl mx-auto h-full flex flex-col">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-3xl font-bold">Global Environment Variables</h1>
        <div class="flex gap-2">
          <span class="text-sm opacity-70">{status}</span>
          <button class="btn btn-outline" onClick={() => (window as any).showSessionsAndProjectsList?.()}>← Back to Dashboard</button>
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


