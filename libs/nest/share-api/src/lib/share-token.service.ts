import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { getLogger } from '@fotobox/logging';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = getLogger('ShareTokenService');

export interface ShareTokenRecord {
  token: string;
  filename: string;
  expiresAt: string;
  createdAt: string;
}

interface PersistedTokensFile {
  tokens: ShareTokenRecord[];
}

@Injectable()
export class ShareTokenService implements OnModuleInit, OnModuleDestroy {
  private tokens = new Map<string, ShareTokenRecord>();
  private readonly tokensFilePath: string;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.tokensFilePath = this.resolveTokensFilePath();
    logger.info(`Using share tokens file: ${this.tokensFilePath}`);
  }

  async onModuleInit(): Promise<void> {
    await this.loadTokens();
    this.cleanupExpired();
    this.cleanupTimer = setInterval(() => this.cleanupExpired(), 60 * 60 * 1000);
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  async createToken(
    filename: string,
    expiryHours: number,
  ): Promise<ShareTokenRecord> {
    const token = crypto.randomBytes(24).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + Math.max(1, expiryHours) * 60 * 60 * 1000,
    );

    const record: ShareTokenRecord = {
      token,
      filename,
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
    };

    this.tokens.set(token, record);
    await this.saveTokens();
    return record;
  }

  getValidToken(token: string): ShareTokenRecord | null {
    const record = this.tokens.get(token);
    if (!record) {
      return null;
    }
    if (new Date(record.expiresAt).getTime() <= Date.now()) {
      return null;
    }
    return record;
  }

  private resolveTokensFilePath(): string {
    const explicitSettingsPath = process.env.FOTOBOX_SETTINGS_PATH;
    if (explicitSettingsPath) {
      const settingsDir = path.dirname(
        path.isAbsolute(explicitSettingsPath)
          ? explicitSettingsPath
          : path.resolve(process.cwd(), explicitSettingsPath),
      );
      return path.join(settingsDir, 'share-tokens.json');
    }
    return path.join(this.getUserDataPath(), 'share-tokens.json');
  }

  private getUserDataPath(): string {
    try {
      const { app } = require('electron');
      return app?.getPath('userData') || process.cwd();
    } catch {
      return process.cwd();
    }
  }

  private async loadTokens(): Promise<void> {
    try {
      const data = await fs.readFile(this.tokensFilePath, 'utf-8');
      const parsed = JSON.parse(data) as PersistedTokensFile;
      this.tokens.clear();
      for (const record of parsed.tokens ?? []) {
        this.tokens.set(record.token, record);
      }
      logger.info(`Loaded ${this.tokens.size} share tokens from file`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info('Share tokens file not found, starting empty');
        await this.saveTokens();
      } else {
        logger.error('Error loading share tokens:', error);
      }
    }
  }

  private async saveTokens(): Promise<void> {
    const payload: PersistedTokensFile = {
      tokens: Array.from(this.tokens.values()),
    };
    await fs.mkdir(path.dirname(this.tokensFilePath), { recursive: true });
    await fs.writeFile(
      this.tokensFilePath,
      JSON.stringify(payload, null, 2),
      'utf-8',
    );
  }

  private cleanupExpired(): void {
    const now = Date.now();
    let removed = 0;
    for (const [token, record] of this.tokens.entries()) {
      if (new Date(record.expiresAt).getTime() <= now) {
        this.tokens.delete(token);
        removed++;
      }
    }
    if (removed > 0) {
      void this.saveTokens();
      logger.info(`Removed ${removed} expired share tokens`);
    }
  }
}
