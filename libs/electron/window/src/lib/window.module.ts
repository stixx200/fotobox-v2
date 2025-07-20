import * as Electron from 'electron';
import {
  ConfigurableModuleBuilder,
  Inject,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { type WindowOptions, WindowService } from './window.service';
import { AppService, AppServiceModule } from '@fotobox/nest-app-service';
import { getLogger } from '@fotobox/logging';

const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<WindowOptions>().build();
export const MAIN_WINDOW_OPTIONS_TOKEN = MODULE_OPTIONS_TOKEN;

const logger = getLogger('WindowModule');

@Module({
  imports: [AppServiceModule],
  controllers: [],
  providers: [
    WindowService,
    { provide: 'ELECTRON_APP', useValue: Electron.app },
  ],
  exports: [WindowService],
})
export class WindowModule
  extends ConfigurableModuleClass
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    @Inject('ELECTRON_APP') private readonly electronApp: Electron.App,
    private readonly appService: AppService,
    @Inject(MAIN_WINDOW_OPTIONS_TOKEN)
    private readonly mainWindowSettings: WindowOptions,
    private readonly windowService: WindowService
  ) {
    super();
    if (!this.electronApp) {
      throw new Error(
        'This application is not running in an Electron environment. Please make sure to run this application with Electron.'
      );
    }
  }

  async onModuleInit() {
    await this.electronApp.whenReady();
    logger.info('WindowModule initialized...');
    this.electronApp.on('window-all-closed', () => {
      // on MacOS it's common to keep the application open
      // if (process.platform !== 'darwin') {
      // Try to shutdown the nest application
      const app = this.appService.getApp();
      app.close();
      // }
    });
    this.electronApp.on('activate', () => this.onActivate); // App is activated
    await this.openMainWindow();
  }

  async onModuleDestroy() {
    this.windowService.closeAll();
    this.electronApp.quit();
  }

  private async openMainWindow() {
    logger.info('Open main window');
    await this.windowService.open('main', this.mainWindowSettings);
  }

  private async onActivate() {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (this.windowService.getWindowCount() === 0) {
      await this.openMainWindow();
    }
  }
}
