import { Injectable } from '@nestjs/common';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { getLogger } from '@fotobox/logging';
import { PrinterInfo } from './models/printer.model';
import { parseLpstatOutput } from './printer-lpstat.parser';
import { parseWindowsPrinterOutput } from './printer-windows.parser';
import * as os from 'os';
import { buildPrintCommand, PrintImageOptions } from './print-command';

const logger = getLogger('PrinterService');
const execPromise = promisify(exec);
const execFilePromise = promisify(execFile);

const PRINT_TIMEOUT_MS = 60_000;

type ExecError = Error & { stdout?: string };

@Injectable()
export class PrinterService {
  async getAvailablePrinters(): Promise<PrinterInfo[]> {
    logger.debug('Fetching available printers');

    const platform = os.platform();

    try {
      if (platform === 'linux' || platform === 'darwin') {
        return await this.getPrintersUnix(platform);
      }
      if (platform === 'win32') {
        return await this.getPrintersWindows();
      }
      logger.warn(
        `Printer detection not implemented for platform: ${platform}`,
      );
      return [];
    } catch (error) {
      logger.error('Error fetching printers:', error);
      return [];
    }
  }

  private async getPrintersUnix(
    platform: 'linux' | 'darwin',
  ): Promise<PrinterInfo[]> {
    try {
      return await this.runLpstat('lpstat -p -d');
    } catch (error) {
      const stdout = (error as ExecError).stdout;
      if (stdout) {
        return parseLpstatOutput(stdout);
      }

      logger.warn(
        `lpstat -p -d failed on ${platform}, falling back to lpstat -p / -d`,
        error,
      );

      try {
        const printerStatus = await this.runLpstat('lpstat -p');
        const defaultDestination = await this.runLpstat('lpstat -d').catch(
          () => '',
        );
        return parseLpstatOutput(`${printerStatus}\n${defaultDestination}`);
      } catch (fallbackError) {
        logger.error(`Error fetching ${platform} printers:`, fallbackError);
        return [];
      }
    }
  }

  private async runLpstat(command: string): Promise<PrinterInfo[]> {
    const { stdout } = await execPromise(command);
    return parseLpstatOutput(stdout);
  }

  private async getPrintersWindows(): Promise<PrinterInfo[]> {
    try {
      const { stdout } = await execPromise(
        'powershell -NoProfile -Command "Get-Printer | Select-Object Name,PrinterStatus,PortName,Default | ConvertTo-Json -Compress"',
        { shell: 'powershell.exe' },
      );
      return parseWindowsPrinterOutput(stdout);
    } catch (error) {
      logger.error('Error fetching Windows printers:', error);
      return [];
    }
  }

  /**
   * Print an image file to the given (or default) printer without a dialog.
   * Rejects with the spooler's error output when printing fails.
   */
  async printImage(
    filePath: string,
    options: PrintImageOptions,
  ): Promise<void> {
    const { command, args, env } = buildPrintCommand(
      os.platform(),
      filePath,
      options,
    );
    logger.info('Printing photo', {
      filePath,
      printerName: options.printerName ?? '(system default)',
      landscape: options.landscape,
    });
    try {
      await execFilePromise(command, args, {
        env: { ...process.env, ...env },
        timeout: PRINT_TIMEOUT_MS,
        windowsHide: true,
      });
    } catch (error) {
      const stderr = (error as { stderr?: string }).stderr?.trim();
      throw new Error(stderr || (error as Error).message, { cause: error });
    }
  }
}
