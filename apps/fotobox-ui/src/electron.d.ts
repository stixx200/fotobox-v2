export interface ElectronAPI {
  platform: string;
  openDirectoryDialog: () => Promise<string | null>;
  getAppVersion: () => Promise<string>;
  printPhoto: (
    photoUrl: string,
  ) => Promise<{ success: boolean; reason?: string }>;
  quit: (code?: number) => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    __FOTOBOX_API_URL__?: string;
  }
}
