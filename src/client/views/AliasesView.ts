import { html } from 'uhtml';

type Props = { onBack: () => void };

export function renderAliasesView(props: Props) {
  let text = '';
  const dataPromise = fetch('/api/aliases').then(r => r.json()).then(d => { text = d.text || ''; return d; });

  const save = async () => {
    const response = await fetch('/api/aliases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    if (!response.ok) {
      try { const err = await response.json(); if (err.details?.length) alert('Save failed:\n' + err.details.join('\n')); else alert('Save failed'); }
      catch { alert('Save failed'); }
    }
  };

  return html`<div class="p-6 max-w-4xl mx-auto h-full flex flex-col">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-3xl font-bold">Shell Aliases Manager</h1>
      <div class="flex gap-2">
        <button class="btn btn-outline" onclick=${props.onBack}>← Back to Dashboard</button>
      </div>
    </div>
    <div class="bg-base-200 rounded-lg p-4 mb-6">
      <p class="text-sm opacity-70 mb-2">Create and manage zsh shell aliases. Use the format: <code>alias name='command'</code> or just <code>name=command</code> (auto-formatted). Changes are automatically saved.</p>
    </div>
    <div class="bg-base-100 rounded-lg border border-base-300 flex-1 flex flex-col">
      <div class="flex items-center justify-between p-4 border-b border-base-300">
        <h2 class="text-xl font-semibold">Shell Aliases</h2>
        <div class="flex gap-2">
          <button class="btn btn-error btn-sm" onclick=${() => { text = ''; save(); }}>Clear All</button>
          <button class="btn btn-primary btn-sm" onclick=${save}>Save Now</button>
        </div>
      </div>
      ${AsyncBlock(dataPromise, () => html`<div class="flex-1 p-4">
        <textarea class="textarea textarea-bordered w-full h-full resize-none font-mono text-sm" placeholder="# Add your shell aliases here\n# Format: alias name='command' or just name=command\n# Examples:\nalias ll='ls -la'\nalias gs='git status'\nalias ..='cd ..'\nalias grep='grep --color=auto'\nalias h='history'\nalias c='clear'"
          spellcheck="false"
          oninput=${(e: Event) => { text = (e.target as HTMLTextAreaElement).value; debounce(save, 2000)(); }}
        >${text}</textarea>
      </div>`)}
    </div>
  </div>`;
}

function AsyncBlock<T>(promise: Promise<T>, view: (v: T) => any) {
  let resolved: T | null = null;
  let error: Error | null = null;
  promise.then(v => { resolved = v; rerender(); }).catch(e => { error = e; rerender(); });
  const rerender = () => window.dispatchEvent(new Event('popstate'));
  if (error) return html`<div class="text-error">${String(error)}</div>`;
  if (resolved) return view(resolved);
  return html`<div class="opacity-70">Loading...</div>`;
}

function debounce<T extends (...args: any[]) => void>(fn: T, wait = 300) {
  let t: number | undefined;
  return (...args: Parameters<T>) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), wait);
  };
}


