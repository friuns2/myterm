import { currentProjectSignal } from './state';

export function NavBar(props: { onBack: () => void; onBrowse: () => void }) {
  return (
    <div id="nav-bar" class="bg-base-200 p-2 border-b border-base-300">
      <div class="flex gap-2 items-center flex-wrap">
        <button class="btn btn-sm btn-outline" onClick={props.onBack}>← Back to Sessions</button>
        <button class="btn btn-sm btn-primary" onClick={props.onBrowse}>📁 Browse</button>
        <span class="text-sm opacity-70">{currentProjectSignal.value ? `Project: ${currentProjectSignal.value}` : ''}</span>
      </div>
    </div>
  );
}


