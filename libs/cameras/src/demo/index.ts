import * as fs from 'fs';
import { Observable, Subject } from 'rxjs';
import { getLogger } from '@fotobox/logging';
import { CameraInterface } from '../camera.interface';
import { resolveRuntimeAsset } from '../resolve-runtime-asset';

const logger = getLogger('camera.demo');

/**
 * Demo Camera
 */
export class DemoCamera implements CameraInterface {
  public driver = 'demo';
  private liveViewSubject = new Subject<string>();
  private picturesSubject = new Subject<string>();

  private giraffe!: Buffer;
  private rabbit!: Buffer;
  private currentPicture!: Buffer;
  private liveViewTimer: any;

  constructor() {
    this.takePicture = this.takePicture.bind(this);
    this.giraffe = fs.readFileSync(
      resolveRuntimeAsset({
        bundleRelativeDir: 'demo-camera',
        filename: 'giraffe.jpg',
        sourceRelativePath: 'libs/cameras/src/demo/giraffe.jpg',
      }),
    );
    this.rabbit = fs.readFileSync(
      resolveRuntimeAsset({
        bundleRelativeDir: 'demo-camera',
        filename: 'rabbit.jpg',
        sourceRelativePath: 'libs/cameras/src/demo/rabbit.jpg',
      }),
    );
    this.currentPicture = this.rabbit;
  }

  /**
   * Initializes camera
   * @returns {Promise<void>}
   */
  async init(): Promise<void> {
    logger.info('Demo camera initialized');
  }

  /**
   * Deinitializes camera
   * @returns {Promise<void>}
   */
  async deinit(): Promise<void> {
    if (this.liveViewTimer) {
      clearInterval(this.liveViewTimer);
      this.liveViewTimer = null;
    }
    logger.info('Demo camera deinitialized');
  }

  /**
   * Takes a picture. The new picture is published via picture observer
   */
  async takePicture(): Promise<void> {
    logger.info('Take picture and send to client.');
    // Emit the current picture as base64 data
    const base64Data = `data:image/jpeg;base64,${this.currentPicture.toString('base64')}`;
    this.picturesSubject.next(base64Data);
  }

  /**
   * Observes the live view.
   * @returns {Observable<string>} Base64 encoded JPEG images
   */
  observeLiveView(): Observable<string> {
    logger.info('Observe live view');

    if (this.liveViewTimer) {
      clearInterval(this.liveViewTimer);
      this.liveViewTimer = null;
    }

    this.liveViewTimer = setInterval(() => {
      if (this.currentPicture === this.rabbit) {
        this.currentPicture = this.giraffe;
      } else {
        this.currentPicture = this.rabbit;
      }
      // Convert buffer to base64
      const base64 = this.currentPicture.toString('base64');
      this.liveViewSubject.next(base64);
    }, 2000);

    setImmediate(() => {
      const base64 = this.currentPicture.toString('base64');
      this.liveViewSubject.next(base64);
    });
    return this.liveViewSubject;
  }

  /**
   * Observes pictures taken.
   * @returns {Observable<string>} Picture IDs
   */
  observePictures(): Observable<string> {
    logger.info('Observe pictures');
    return this.picturesSubject;
  }

  /**
   * Stop live view streaming
   */
  async stopLiveView(): Promise<void> {
    if (this.liveViewTimer) {
      clearInterval(this.liveViewTimer);
      this.liveViewTimer = null;
      logger.info('Live view stopped');
    }
  }

  /**
   * Check if camera is available
   */
  isAvailable(): boolean {
    return true; // Demo camera is always available
  }
}
