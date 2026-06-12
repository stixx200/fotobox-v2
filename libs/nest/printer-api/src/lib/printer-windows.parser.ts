import { getLogger } from '@fotobox/logging';
import { PrinterInfo } from './models/printer.model';

const logger = getLogger('PrinterWindowsParser');

type WindowsPrinterJson = {
  Name?: string;
  PrinterStatus?: number;
  PortName?: string;
  Default?: boolean;
};

function isPrinterAvailable(status: number | undefined): boolean {
  // 0 = Normal, 1 = Paused (still listed and usable in many setups)
  return status === undefined || status === 0 || status === 1;
}

/** Parse PowerShell `Get-Printer | ConvertTo-Json` output. */
export function parseWindowsPrinterOutput(output: string): PrinterInfo[] {
  const trimmed = output.trim().replace(/^\uFEFF/, '');
  if (!trimmed) {
    return [];
  }

  try {
    let data: WindowsPrinterJson | WindowsPrinterJson[] | null =
      JSON.parse(trimmed);
    if (data === null) {
      return [];
    }
    if (!Array.isArray(data)) {
      data = [data];
    }

    return data
      .filter((printer): printer is WindowsPrinterJson => Boolean(printer?.Name))
      .map((printer) => ({
        name: String(printer.Name),
        description: printer.PortName ? String(printer.PortName) : undefined,
        state: isPrinterAvailable(printer.PrinterStatus) ? 'idle' : 'error',
        isDefault: Boolean(printer.Default),
      }));
  } catch (error) {
    logger.error('Error parsing Windows printer output:', error);
    return [];
  }
}
