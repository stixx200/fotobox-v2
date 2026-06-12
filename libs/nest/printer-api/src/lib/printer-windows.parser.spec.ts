import { describe, expect, it } from 'vitest';
import { parseWindowsPrinterOutput } from './printer-windows.parser';

describe('parseWindowsPrinterOutput', () => {
  it('parses a single printer object', () => {
    const output = JSON.stringify({
      Name: 'HP LaserJet',
      PrinterStatus: 0,
      PortName: 'USB001',
      Default: true,
    });

    expect(parseWindowsPrinterOutput(output)).toEqual([
      {
        name: 'HP LaserJet',
        description: 'USB001',
        state: 'idle',
        isDefault: true,
      },
    ]);
  });

  it('parses multiple printers from an array', () => {
    const output = JSON.stringify([
      {
        Name: 'HP LaserJet',
        PrinterStatus: 0,
        PortName: 'USB001',
        Default: false,
      },
      {
        Name: 'Canon SELPHY',
        PrinterStatus: 1,
        PortName: 'WSD-123',
        Default: true,
      },
    ]);

    expect(parseWindowsPrinterOutput(output)).toEqual([
      {
        name: 'HP LaserJet',
        description: 'USB001',
        state: 'idle',
        isDefault: false,
      },
      {
        name: 'Canon SELPHY',
        description: 'WSD-123',
        state: 'idle',
        isDefault: true,
      },
    ]);
  });

  it('marks unavailable printers as error', () => {
    const output = JSON.stringify({
      Name: 'Broken Printer',
      PrinterStatus: 2,
      PortName: 'LPT1:',
      Default: false,
    });

    expect(parseWindowsPrinterOutput(output)).toEqual([
      expect.objectContaining({
        name: 'Broken Printer',
        state: 'error',
      }),
    ]);
  });

  it('handles empty output and UTF-8 BOM', () => {
    expect(parseWindowsPrinterOutput('')).toEqual([]);
    expect(parseWindowsPrinterOutput('\uFEFF')).toEqual([]);
    expect(
      parseWindowsPrinterOutput(
        `\uFEFF${JSON.stringify({
          Name: 'BOM Printer',
          PrinterStatus: 0,
          PortName: 'PORT1',
          Default: false,
        })}`,
      ),
    ).toEqual([
      expect.objectContaining({
        name: 'BOM Printer',
      }),
    ]);
  });

  it('returns an empty list for invalid JSON', () => {
    expect(parseWindowsPrinterOutput('not-json')).toEqual([]);
  });
});
