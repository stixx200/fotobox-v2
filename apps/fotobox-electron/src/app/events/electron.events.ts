/**
 * This module is responsible on handling all the inter process communications
 * between the frontend to the electron backend.
 */

import { app, ipcMain, dialog } from 'electron';

export default class ElectronEvents {
  static bootstrapElectronEvents(): Electron.IpcMain {
    return ipcMain;
  }
}

// Retrieve app version
ipcMain.handle('get-app-version', (event) => {
  return 'unknown';
});

// Handle directory picker dialog
ipcMain.handle('open-directory-dialog', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'Ordner auswählen',
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

// Handle App termination
ipcMain.on('quit', (event, code) => {
  app.exit(code);
});
