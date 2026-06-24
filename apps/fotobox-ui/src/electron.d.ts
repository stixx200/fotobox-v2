export interface PrintPhotoOptions {
  printerName?: string;
  silent?: boolean;
  landscape?: boolean;
}

export interface ElectronAPI {
  platform: string;
  openDirectoryDialog: () => Promise<string | null>;
  openCollageEditor: (
    collageDirectory?: string,
  ) => Promise<{ success: boolean }>;
  getAppVersion: () => Promise<string>;
  printPhoto: (
    photoUrl: string,
    options?: PrintPhotoOptions,
  ) => Promise<{ success: boolean; reason?: string }>;
  quit: (code?: number) => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    __FOTOBOX_API_URL__?: string;
  }
}
