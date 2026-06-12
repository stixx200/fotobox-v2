import { Injectable } from '@nestjs/common';
import * as os from 'os';
import { SettingsService } from '@fotobox/nest-settings';

const PREFERRED_INTERFACES = ['en0', 'wlan0', 'eth0', 'en1', 'wlan1'];

@Injectable()
export class LanUrlService {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Returns the base URL guests should use to reach the API on the LAN.
   * Uses `shareBaseUrl` from settings when set, otherwise auto-detects a
   * non-internal IPv4 address on a local network interface.
   */
  async getShareBaseUrl(): Promise<string> {
    const override = await this.readShareBaseUrlOverride();
    if (override) {
      return this.normalizeBaseUrl(override);
    }

    const detectedIp = this.detectLanIpv4();
    const port = Number(process.env.PORT) || 3000;
    return `http://${detectedIp}:${port}`;
  }

  /** Auto-detected LAN URL without settings override (for settings UI preview). */
  getDetectedShareBaseUrl(): string {
    const port = Number(process.env.PORT) || 3000;
    return `http://${this.detectLanIpv4()}:${port}`;
  }

  private async readShareBaseUrlOverride(): Promise<string | null> {
    const setting = await this.settingsService.getSetting('shareBaseUrl');
    if (!setting?.value) {
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(setting.value);
      if (typeof parsed === 'string' && parsed.trim() !== '') {
        return parsed.trim();
      }
    } catch {
      // ignore malformed value
    }
    return null;
  }

  private detectLanIpv4(): string {
    const interfaces = os.networkInterfaces();
    const candidates: { name: string; address: string }[] = [];

    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) {
        continue;
      }
      for (const addr of addrs) {
        if (addr.family !== 'IPv4' || addr.internal) {
          continue;
        }
        candidates.push({ name, address: addr.address });
      }
    }

    for (const preferred of PREFERRED_INTERFACES) {
      const match = candidates.find((c) => c.name === preferred);
      if (match) {
        return match.address;
      }
    }

    if (candidates.length > 0) {
      return candidates[0].address;
    }

    return '127.0.0.1';
  }

  private normalizeBaseUrl(url: string): string {
    return url.replace(/\/+$/, '');
  }
}
