export class AppService {
  private app: any;

  setApp(app: any) {
    this.app = app;
  }

  getApp(): any {
    if (!this.app) {
      throw new Error(
        'App has not been set. Call AppService.setApp(app) first.'
      );
    }
    return this.app;
  }
}
