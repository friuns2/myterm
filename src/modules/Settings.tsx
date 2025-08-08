import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

const textSignal = signal('');

export function Settings(props: { onBack: () => void }) {
  const load = async () => {
    const res = await fetch('/api/settings');
    const data = await res.json();
    textSignal.value = data.text || '';
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: textSignal.value }) });
  };

  return (
    <div class="p-6 max-w-4xl mx-auto h-full flex flex-col">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-3xl font-bold">Shell Settings</h1>
        <div class="flex gap-2">
          <button class="btn btn-outline" onClick={props.onBack}>← Back to Dashboard</button>
        </div>
      </div>

      <div class="bg-base-100 rounded-lg border border-base-300 flex-1 flex flex-col">
        <div class="flex items-center justify-between p-4 border-b border-base-300">
          <h2 class="text-xl font-semibold">Shell Settings</h2>
          <div class="flex gap-2">
            <button class="btn btn-primary btn-sm" onClick={save}>Save Now</button>
          </div>
        </div>
        <div class="flex-1 p-4">
          <textarea class="textarea textarea-bordered w-full h-full resize-none font-mono text-sm" spellcheck={false} value={textSignal.value} onInput={(e) => (textSignal.value = (e.currentTarget as HTMLTextAreaElement).value)} />
        </div>
      </div>
    </div>
  );
}


