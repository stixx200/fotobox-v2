import { globalShortcut } from "electron";
import * as fs from "fs";
import * as path from "path";
import { Observable, Subject } from "rxjs";
import { switchMap } from "rxjs/operators";
import { CameraInitConfiguration } from "../../../shared/init-configuration.interface";
import { ClientProxy } from "../../client.proxy";
import { PhotoHandler } from "../../photo.handler";
import {ShutdownHandler}'../../shutdown.handler'ndler";
import {CameraInterface}'../camera.interface'rface";

const logger = require("logger-winston").getLogger("camera.demo");

/**
 * Demo Camera
 */
export class DemoCamera implements CameraInterface {
  private photosaver: PhotoHandler;

  private liveViewSubject = new Subject<Buffer>();
  private picturesSubject = new Subject<Buffer>();

  private giraffe = fs.readFileSync(path.join(__dirname, "giraffe.jpg"));
  private rabbit = fs.readFileSync(path.join(__dirname, "rabbit.jpg"));
  private currentPicture = this.rabbit;
  private liveViewTimer: any;

  constructor() {
    this.takePicture = this.takePicture.bind(this);
  }

  /**
   * Initializes camera
   * @param {CameraInitConfiguration} config
   * @param {{clientProxy: ClientProxy}} externals
   * @returns {Promise<void>}
   */
  async init(
    config: CameraInitConfiguration,
    externals: { clientProxy: ClientProxy; shutdownHandler: ShutdownHandler; photosaver: PhotoHandler },
  ) {
    this.photosaver = externals.photosaver;

    globalShortcut.register("CmdOrCtrl+N", this.takePicture);
  }

  /**
   * Deinitializes camera
   * @returns {Promise<void>}
   */
  async deinit() {
    globalShortcut.unregister('CmdOrCtrl+N');
    this.stopLiveView();
  }

  /**
   * Takes a picture. The new picture is published via picture observer
   */
  takePicture(): void {
    logger.info('Take picture and send to client.');
    this.picturesSubject.next(this.currentPicture);
  }

  /**
   * Observes the live view.
   * @returns {Observable<Buffer>}
   */
  observeLiveView(): Observable<Buffer> {
    logger.info('Observe live view');
    this.liveViewTimer = setInterval(() => {
      if (this.currentPicture === this.rabbit) {
        this.currentPicture = this.giraffe;
      } else {
        this.currentPicture = this.rabbit;
      }
      this.liveViewSubject.next(this.currentPicture);
    }, 2000);

    setImmediate(() => this.liveViewSubject.next(this.currentPicture));
    return this.liveViewSubject;
  }

  /**
   * Observes the live view.
   * @returns {Observable<Buffer>}
   */
  observePictures(): Observable<string> {
    logger.info('Observe pictures');
    return this.picturesSubject.pipe(
      switchMap((buffer: Buffer) => {
        return this.photosaver.saveBinaryCollage(buffer, '.jpg');
      }),
    );
  }

  /**
   * Stops live view.
   * @returns {Observable<string>}
   */
  stopLiveView() {
    logger.info('Stop live view');
    clearInterval(this.liveViewTimer);
  }
}
