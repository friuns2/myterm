// Shared client state

export type NullableString = string | null;

export const state = {
  sessionID: null as NullableString,
  currentProject: null as NullableString,
  isFileBrowserOpen: false,
  isFileEditorOpen: false,
  currentEditingFile: null as NullableString,
  currentBrowserPath: null as NullableString,
  isConnected: false,
};


