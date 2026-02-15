import * as fs from 'fs';
import * as path from 'path';
import { Observable, Subject } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { getLogger } from '@fotobox/logging';
import { CameraInitConfiguration } from '@fotobox/cameras';
import { CameraInterface } from '../camera.interface';

const logger = getLogger('camera.demo');

/**
 * Demo Camera
 */
export class DemoCamera implements CameraInterface {
  private liveViewSubject = new Subject<Buffer>();
  private picturesSubject = new Subject<Buffer>();

  private giraffe = fs.readFileSync(path.join(__dirname, 'giraffe.jpg'));
  private rabbit = fs.readFileSync(path.join(__dirname, 'rabbit.jpg'));
  private currentPicture = this.rabbit;
  private liveViewTimer: any;

  constructor() {
    this.takePicture = this.takePicture.bind(this);
  }

  /**
   * Initializes camera
   * @param {CameraInitConfiguration} config
   * @returns {Promise<void>}
   */
  async init(config: CameraInitConfiguration) {}

  /**
   * Deinitializes camera
   * @returns {Promise<void>}
   */
  async deinit() {}

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
  observePictures(): Observable<Buffer> {
    logger.info('Observe pictures');
    return this.picturesSubject;
  }
}
