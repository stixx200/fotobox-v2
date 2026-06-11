import { contextBridge, ipcRenderer } from 'electron';

// The API URL is passed from the main process via additionalArguments so the
// renderer (Angular) knows where to reach the GraphQL API. This is read by the
// UI's runtime API-config resolver (window.__FOTOBOX_API_URL__).
const apiUrlArg = process.argv.find((arg) =>
  arg.startsWith('--fotobox-api-url='),
);
const apiUrl = apiUrlArg ? apiUrlArg.split('=').slice(1).join('=') : '';
if (apiUrl) {
  contextBridge.exposeInMainWorld('__FOTOBOX_API_URL__', apiUrl);
}

// Minimal native bridge. Camera/printer/settings all go through GraphQL.
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  printPhoto: (photoUrl: string) =>
    ipcRenderer.invoke('print-photo', photoUrl),
  quit: (code?: number) => ipcRenderer.send('quit', code),
});
