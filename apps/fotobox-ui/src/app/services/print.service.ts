import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PrintService {
  /**
   * Print a single photo.
   *
   * - In Electron: delegates to the native print dialog via IPC
   *   (`window.electron.printPhoto`).
   * - In a plain browser: opens a minimal print page in a new window
   *   containing only the image and triggers `window.print()`.
   */
  printPhoto(photoUrl: string): void {
    if (typeof window !== 'undefined' && window.electron?.printPhoto) {
      window.electron.printPhoto(photoUrl).catch((err) => {
        console.error('Electron print failed:', err);
      });
      return;
    }

    // Browser fallback: open a barebones page, wait for the image to load,
    // then trigger the print dialog and close the window.
    const win = window.open('', '_blank');
    if (!win) return;

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Drucken</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; }
    img { max-width: 100%; max-height: 100%; object-fit: contain; }
    @media print {
      body { height: auto; }
      img { width: 100%; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <img src="${photoUrl}" onload="window.print(); window.close();" />
</body>
</html>`);
    win.document.close();
  }
}
