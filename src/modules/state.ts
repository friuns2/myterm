import { signal, computed, batch } from '@preact/signals';

// URL helpers
const getUrlParam = (name: string): string | null => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
};

export const sessionIdSignal = signal<string | null>(getUrlParam('session'));
export const currentProjectSignal = signal<string | null>(getUrlParam('project'));

export const isFileBrowserOpenSignal = signal(false);
export const isFileEditorOpenSignal = signal(false);

export const currentEditingFileSignal = signal<string | null>(null);
export const currentBrowserPathSignal = signal<string | null>(null);

export const hasActiveSessionSignal = computed(() => !!sessionIdSignal.value);

export function updateUrlWithSession(sessionId: string, projectName?: string | null) {
  const url = new URL(window.location.href);
  url.searchParams.set('session', sessionId);
  if (projectName) {
    url.searchParams.set('project', projectName);
  }
  window.history.pushState({ sessionId }, '', url);
}

export function clearUrlParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete('session');
  url.searchParams.delete('project');
  window.history.replaceState({}, '', url);
  batch(() => {
    sessionIdSignal.value = null;
    currentProjectSignal.value = null;
  });
}


