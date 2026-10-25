import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startApi, testDirs, type TestApi } from './support/test-app';

/**
 * Nothing is ever sent to a real printer: fake CUPS `lp` / `lpstat` binaries
 * are put first on PATH (the API spawns them by name). Only "IT_Printer"
 * exists; any other `-d` printer fails with the message real CUPS prints.
 * Windows prints through PowerShell/System.Drawing and is not covered here.
 */
const PRINTER = 'IT_Printer';

const FAKE_LP = `#!/bin/sh
printf '%s\\n' "$@" > "$FOTOBOX_IT_LP_LOG"
printer=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-d" ]; then printer="$2"; fi
  shift
done
if [ -n "$printer" ] && [ "$printer" != "${PRINTER}" ]; then
  echo "lp: The printer or class does not exist." >&2
  exit 1
fi
echo "request id is ${PRINTER}-1 (1 file(s))"
`;

const FAKE_LPSTAT = `#!/bin/sh
echo "printer ${PRINTER} is idle.  enabled since Sun Oct 25 12:00:00 2026"
echo "system default destination: ${PRINTER}"
`;

const PRINT_PHOTO = /* GraphQL */ `
  mutation ($input: PrintPhotoInput!) {
    printPhoto(input: $input) {
      success
      message
    }
  }
`;

interface PrintResult {
  success: boolean;
  message: string | null;
}

describe.skipIf(process.platform === 'win32')('printing (fake CUPS)', () => {
  let api: TestApi;
  let fakeBin: string;
  let lpLog: string;
  const photo = 'photo-print.jpg';

  beforeAll(async () => {
    fakeBin = path.join(testDirs.root, 'fake-bin');
    fs.mkdirSync(fakeBin, { recursive: true });
    fs.writeFileSync(path.join(fakeBin, 'lp'), FAKE_LP, { mode: 0o755 });
    fs.writeFileSync(path.join(fakeBin, 'lpstat'), FAKE_LPSTAT, {
      mode: 0o755,
    });
    lpLog = path.join(testDirs.root, 'lp-args.log');
    fs.writeFileSync(path.join(testDirs.photos, photo), 'jpeg bytes');

    api = await startApi({
      PATH: `${fakeBin}${path.delimiter}${process.env['PATH'] ?? ''}`,
      FOTOBOX_IT_LP_LOG: lpLog,
    });
  });

  afterAll(async () => {
    await api?.close();
  });

  beforeEach(() => {
    fs.rmSync(lpLog, { force: true });
  });

  const lpArgs = () => fs.readFileSync(lpLog, 'utf8').trimEnd().split('\n');

  async function printPhoto(input: Record<string, unknown>) {
    const { printPhoto } = await api.gqlOk<{ printPhoto: PrintResult }>(
      PRINT_PHOTO,
      { input },
    );
    return printPhoto;
  }

  it('lists the printers reported by lpstat', async () => {
    const { availablePrinters } = await api.gqlOk<{
      availablePrinters: {
        count: number;
        items: { name: string; state: string; isDefault: boolean }[];
      };
    }>('query { availablePrinters { count items { name state isDefault } } }');
    expect(availablePrinters).toEqual({
      count: 1,
      items: [{ name: PRINTER, state: 'idle', isDefault: true }],
    });
  });

  it('sends a stored photo to the chosen printer', async () => {
    await expect(
      printPhoto({ filename: photo, printerName: PRINTER, landscape: false }),
    ).resolves.toEqual({ success: true, message: null });
    expect(lpArgs()).toEqual([
      '-d',
      PRINTER,
      '-o',
      'fit-to-page',
      '-o',
      'portrait',
      '--',
      path.join(testDirs.photos, photo),
    ]);

    // Landscape is the default; no printer name means the system default.
    await printPhoto({ filename: photo });
    expect(lpArgs()).toEqual([
      '-o',
      'fit-to-page',
      '-o',
      'landscape',
      '--',
      path.join(testDirs.photos, photo),
    ]);
  });

  it('returns the spooler error for an unknown printer', async () => {
    await expect(
      printPhoto({ filename: photo, printerName: 'No_Such_Printer' }),
    ).resolves.toEqual({
      success: false,
      message: 'lp: The printer or class does not exist.',
    });
  });

  it('returns a readable error for a missing photo without calling lp', async () => {
    await expect(
      printPhoto({ filename: 'photo-missing.jpg', printerName: PRINTER }),
    ).resolves.toEqual({
      success: false,
      message: 'Photo not found: photo-missing.jpg',
    });
    expect(fs.existsSync(lpLog)).toBe(false);
  });

  it('refuses files outside the photo directory', async () => {
    fs.writeFileSync(path.join(testDirs.root, 'secret.jpg'), 'secret');
    const result = await api.gql(PRINT_PHOTO, {
      input: { filename: '../secret.jpg', printerName: PRINTER },
    });
    expect(result.errors?.[0]?.message).toBe('Photo not found');
    expect(fs.existsSync(lpLog)).toBe(false);
  });

  it('explains when no print system is installed', async () => {
    const pathBefore = process.env['PATH'];
    // An empty directory: neither lp nor lpstat can be found.
    const emptyBin = path.join(testDirs.root, 'empty-bin');
    fs.mkdirSync(emptyBin, { recursive: true });
    process.env['PATH'] = emptyBin;
    try {
      await expect(
        printPhoto({ filename: photo, printerName: PRINTER }),
      ).resolves.toEqual({
        success: false,
        message:
          "Print command 'lp' not found — no print system (CUPS) installed?",
      });
    } finally {
      process.env['PATH'] = pathBefore;
    }
  });
});
