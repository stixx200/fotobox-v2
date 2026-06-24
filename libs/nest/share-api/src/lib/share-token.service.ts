import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { getLogger } from '@fotobox/logging';
import { DRIZZLE, type DrizzleDb } from '@fotobox/nest-database';
import { shareTokens } from '@fotobox/nest-database';
import * as crypto from 'crypto';
import { and, eq, gt, lte } from 'drizzle-orm';

const logger = getLogger('ShareTokenService');

export interface ShareTokenRecord {
  token: string;
  filename: string;
  expiresAt: string;
  createdAt: string;
}

@Injectable()
export class ShareTokenService implements OnModuleInit, OnModuleDestroy {
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async onModuleInit(): Promise<void> {
    await this.cleanupExpired();
    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpired();
    }, 60 * 60 * 1000);
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

    this.db.insert(shareTokens).values(record).run();
    return record;
  }

  getValidToken(token: string): ShareTokenRecord | null {
    const now = new Date().toISOString();
    const row = this.db
      .select()
      .from(shareTokens)
      .where(and(eq(shareTokens.token, token), gt(shareTokens.expiresAt, now)))
      .get();

    return row ?? null;
  }

  private async cleanupExpired(): Promise<void> {
    const now = new Date().toISOString();
    const result = this.db
      .delete(shareTokens)
      .where(lte(shareTokens.expiresAt, now))
      .run();

    if (result.changes > 0) {
      logger.info(`Removed ${result.changes} expired share tokens`);
    }
  }
}
