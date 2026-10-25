import type { INestApplicationContext } from '@nestjs/common';

export class AppService {
  private app?: INestApplicationContext;

  setApp(app: INestApplicationContext) {
    this.app = app;
  }

  getApp(): INestApplicationContext {
    if (!this.app) {
      throw new Error(
        'App has not been set. Call AppService.setApp(app) first.',
      );
    }
    return this.app;
  }
}
