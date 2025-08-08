import { html } from 'uhtml';

type Props = { onBack: () => void };

export function renderEnvironmentView(props: Props) {
  let text = '';
  const envPromise = fetch('/api/environment').then(r => r.json()).then(d => { text = d.text || ''; return d; });

  const save = async () => {
    const response = await fetch('/api/environment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text })
    });
    if (!response.ok) alert('Save failed');
  };

  return html`<div class="p-6 max-w-4xl mx-auto h-full flex flex-col">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-3xl font-bold">Global Environment Variables</h1>
      <div class="flex gap-2">
        <button class="btn btn-outline" onclick=${props.onBack}>← Back to Dashboard</button>
      </div>
    </div>
    <div class="bg-base-200 rounded-lg p-4 mb-6">
      <p class="text-sm opacity-70 mb-2">Edit environment variables in KEY=VALUE format. Comments starting with # are ignored. These variables will be available in all new terminal sessions across all projects.</p>
      <p class="text-xs opacity-50">Example: NODE_ENV=production</p>
    </div>
    <div class="bg-base-100 rounded-lg border border-base-300 flex-1 flex flex-col">
      <div class="flex items-center justify-between p-4 border-b border-base-300">
        <h2 class="text-xl font-semibold">Environment Variables</h2>
        <div class="flex gap-2">
          <button class="btn btn-error btn-sm" onclick=${() => { text = ''; save(); }}>Clear All</button>
          <button class="btn btn-primary btn-sm" onclick=${save}>Save Now</button>
        </div>
      </div>
      ${AsyncBlock(envPromise, () => html`<div class="flex-1 p-4">
        <textarea class="textarea textarea-bordered w-full h-full resize-none font-mono text-sm" placeholder="# Add your environment variables here\n# Format: KEY=VALUE\n# Example:\nNODE_ENV=production\nAPI_URL=https://api.example.com\nDEBUG=true"
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


