import { ipcMain } from "electron";
import { Subscription } from "rxjs";
import { TOPICS } from "../../shared/constants";
import { CameraProviderInitConfig } from "../../shared/init-configuration.interface";
import { ClientProxy } from "../client.proxy";
import { PhotoHandler } from "../photo.handler";
import { ShutdownHandler } from "../shutdown.handler";
import { CameraInterface } from "./camera.interface";
import { DemoCamera } from "./demo";
import { SonyCamera } from "./sony";

const logger = require("logger-winston").getLogger("camera.provider");

const cameras = {
  sony: SonyCamera,
  demo: DemoCamera,
};

const getCamera = (cameraDriver: string): CameraInterface => {
  if (!cameras[cameraDriver]) {
    throw new Error(`Driver '${cameraDriver}' not available.`);
  }
  return new cameras[cameraDriver]();
};

export class CameraProvider {
  private camera: CameraInterface = null;
  private liveViewSubscription: Subscription;
  private client: ClientProxy;
  private picturesSubscription: Subscription;

  constructor() {
    this.takePicture = this.takePicture.bind(this);
  }

  static getCameraDriverNames() {
    return Object.keys(cameras);
  }

  async init(
    config: CameraProviderInitConfig,
    externals: { clientProxy: ClientProxy; shutdownHandler: ShutdownHandler; photosaver: PhotoHandler },
  ) {
    this.client = externals.clientProxy;

    this.camera = getCamera(config.cameraDriver);
    await this.camera.init(config, externals);

    ipcMain.on(TOPICS.TAKE_PICTURE, this.takePicture);

    this.startLiveViewObserving();
    this.picturesSubscription = this.camera
      .observePictures()
      .subscribe((fileName: string) => this.onNewPhoto(fileName));
  }

  async deinit() {
    if (this.liveViewSubscription) {
      this.liveViewSubscription.unsubscribe();
      this.liveViewSubscription = null;
    }
    if (this.picturesSubscription) {
      this.picturesSubscription.unsubscribe();
      this.picturesSubscription = null;
    }

    ipcMain.removeListener(TOPICS.TAKE_PICTURE, this.takePicture);

    if (this.camera) {
      await this.camera.deinit();
      this.camera = null;
    }

    this.client = null;
  }

  startLiveViewObserving() {
    // don't start live view twice
    if (this.liveViewSubscription) {
      logger.warn("LiveViewObserving started twice. Ignore last call.");
      return;
    }

    this.liveViewSubscription = this.camera.observeLiveView().subscribe((data: any) => {
      this.client.send(TOPICS.LIVEVIEW_DATA, data);
    });
  }

  takePicture() {
    this.camera.takePicture();
  }

  private onNewPhoto(fileName: string) {
    this.client.send(TOPICS.PHOTO, fileName);
  }
}
