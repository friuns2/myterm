// Shared client state using Preact Signals
import { signal } from '@preact/signals';

export type NullableString = string | null;

export const sessionID = signal<NullableString>(null);
export const currentProject = signal<NullableString>(null);

export const isFileBrowserOpen = signal<boolean>(false);
export const isFileEditorOpen = signal<boolean>(false);

export const currentEditingFile = signal<NullableString>(null);
export const currentBrowserPath = signal<NullableString>(null);

export const isConnected = signal<boolean>(false);



