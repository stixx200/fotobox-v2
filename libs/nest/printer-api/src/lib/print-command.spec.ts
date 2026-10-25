import { describe, expect, it } from 'vitest';
import { buildPrintCommand } from './print-command';

describe('buildPrintCommand', () => {
  it('uses lp with fit-to-page on macOS/Linux', () => {
    expect(
      buildPrintCommand('darwin', '/photos/a.jpg', {
        printerName: 'Canon_SELPHY',
        landscape: true,
      }),
    ).toEqual({
      command: 'lp',
      args: [
        '-d',
        'Canon_SELPHY',
        '-o',
        'fit-to-page',
        '-o',
        'landscape',
        '--',
        '/photos/a.jpg',
      ],
      env: {},
    });
  });

  it('prints to the default CUPS printer when none is configured', () => {
    const { args } = buildPrintCommand('linux', '/photos/-a.jpg', {
      printerName: '  ',
      landscape: false,
    });
    expect(args).not.toContain('-d');
    expect(args).toContain('portrait');
    // `--` keeps a file name starting with "-" from being read as an option.
    expect(args.slice(-2)).toEqual(['--', '/photos/-a.jpg']);
  });

  it('passes inputs to PowerShell via env, not the script', () => {
    const file = "C:\\photos\\x'; Remove-Item C:\\ -Recurse #.jpg";
    const cmd = buildPrintCommand('win32', file, {
      printerName: 'Printer "1"',
      landscape: true,
    });
    expect(cmd.command).toBe('powershell.exe');
    expect(cmd.args.join(' ')).not.toContain(file);
    expect(cmd.args.join(' ')).not.toContain('Printer "1"');
    expect(cmd.env).toEqual({
      FOTOBOX_PRINT_FILE: file,
      FOTOBOX_PRINT_PRINTER: 'Printer "1"',
      FOTOBOX_PRINT_LANDSCAPE: '1',
    });
  });
});
