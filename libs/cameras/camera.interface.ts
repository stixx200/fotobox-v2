import { Observable } from "rxjs";
import { CameraInitConfiguration } from "../../shared/init-configuration.interface";
import { ClientProxy } from "../client.proxy";
import { PhotoHandler } from "../photo.handler";

export interface CameraInterface {
  init(
    initConfig: CameraInitConfiguration,
    externals: { clientProxy: ClientProxy; photosaver: PhotoHandler },
  ): Promise<void>;

  deinit(): Promise<void>;

  takePicture(): void;

  observeLiveView(): Observable<Buffer>;

  stopLiveView();

  observePictures(): Observable<string>;
}
