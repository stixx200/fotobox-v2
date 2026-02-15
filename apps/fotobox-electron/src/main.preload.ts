import { contextBridge } from 'electron';

// Minimal preload script - GraphQL communication is now used instead of IPC
// Only platform information is exposed as it's not available in the renderer
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
});
