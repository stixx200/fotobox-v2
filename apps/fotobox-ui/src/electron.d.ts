export interface ElectronAPI {
  platform: string;
  openDirectoryDialog: () => Promise<string | null>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
