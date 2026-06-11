import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getLogger } from '@fotobox/logging';
import { PrinterInfo } from './models/printer.model';
import * as os from 'os';

const logger = getLogger('PrinterService');
const execPromise = promisify(exec);

@Injectable()
export class PrinterService {
  async getAvailablePrinters(): Promise<PrinterInfo[]> {
    logger.debug('Fetching available printers');
    
    const platform = os.platform();
    
    try {
      if (platform === 'linux') {
        return await this.getPrintersLinux();
      } else if (platform === 'darwin') {
        return await this.getPrintersMacOS();
      } else if (platform === 'win32') {
        return await this.getPrintersWindows();
      } else {
        logger.warn(`Printer detection not implemented for platform: ${platform}`);
        return [];
      }
    } catch (error) {
      logger.error('Error fetching printers:', error);
      return [];
    }
  }

  private async getPrintersLinux(): Promise<PrinterInfo[]> {
    try {
      const { stdout } = await execPromise('lpstat -p -d');
      return this.parseLpstatOutput(stdout);
    } catch (error) {
      logger.error('Error fetching Linux printers:', error);
      return [];
    }
  }

  private async getPrintersMacOS(): Promise<PrinterInfo[]> {
    try {
      const { stdout } = await execPromise('lpstat -p -d');
      return this.parseLpstatOutput(stdout);
    } catch (error) {
      logger.error('Error fetching macOS printers:', error);
      return [];
    }
  }

  private async getPrintersWindows(): Promise<PrinterInfo[]> {
    try {
      const { stdout } = await execPromise(
        'powershell -NoProfile -Command "Get-Printer | Select-Object Name,PrinterStatus,PortName | ConvertTo-Json"',
        { shell: 'powershell.exe' }
      );
      return this.parseWindowsOutput(stdout);
    } catch (error) {
      logger.error('Error fetching Windows printers:', error);
      return [];
    }
  }

  private parseLpstatOutput(output: string): PrinterInfo[] {
    const printers: PrinterInfo[] = [];
    const lines = output.split('\n');
    let defaultPrinter: string | null = null;

    for (const line of lines) {
      // Get default printer from line like "device for HP-LaserJet: ..."
      if (line.includes('device for')) {
        const match = line.match(/device for (.+?):/);
        if (match) {
          defaultPrinter = match[1].trim();
        }
      }

      // Get printers from line like "printer HP-LaserJet is idle..."
      if (line.includes('printer ')) {
        const match = line.match(/printer (.+?) is/);
        if (match) {
          const name = match[1].trim();
          const state = line.includes('idle') ? 'idle' : 'error';
          printers.push({
            name,
            state,
            isDefault: name === defaultPrinter,
          });
        }
      }
    }

    return printers;
  }

  private parseWindowsOutput(output: string): PrinterInfo[] {
    try {
      let data = JSON.parse(output);
      // Handle both array and single object responses
      if (!Array.isArray(data)) {
        data = [data];
      }

      return data.map((printer: any) => ({
        name: printer.Name,
        description: printer.PortName,
        state: printer.PrinterStatus === 0 ? 'idle' : 'error',
      }));
    } catch (error) {
      logger.error('Error parsing Windows printer output:', error);
      return [];
    }
  }
}
