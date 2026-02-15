import { getLogger } from '@fotobox/logging';
import { Client as SsdpClient, SsdpHeaders } from 'node-ssdp';
import { Observable, throwError } from 'rxjs';
import { CameraInterface } from '../camera.interface';
import { SonyCameraCommunication } from './camera';
import { FotoboxError } from "@fotobox/error";

const logger = getLogger('camera.sony');

const M_SEARCH_CAMERA = 'urn:schemas-sony-com:service:ScalarWebAPI:1';

/**
 * Sony Camera
 */
export class SonyCamera implements CameraInterface {
  private camera: SonyCameraCommunication | null = null;
  private isInitialized = false;
  private ssdpInterval: NodeJS.Timeout | null = null;
  private abortSearching = false;

  /**
   * Initializes camera
   * @param {CameraInitConfiguration} config
   * @param {{clientProxy: ClientProxy}} externals
   * @returns {Promise<void>}
   */
  async init() {
    this.abortSearching = false;
    if (this.isInitialized) {
      await this.deinit();
    }

    const descriptionUrl = await this.findCamera();
    await this.initializeCamera(descriptionUrl);
  }

  /**
   * Deinitializes camera
   * @returns {Promise<void>}
   */
  async deinit() {
    this.abortSearching = true;

    // clear interval
    if (this.ssdpInterval) {
      clearInterval(this.ssdpInterval);
      this.ssdpInterval = null;
    }

    logger.info('destroy camera');
    if (this.camera) {
      await this.camera.deinit();
    }
    this.camera = null;
  }

  /**
   * Takes a picture. The new picture is published via picture observer
   */
  takePicture(): void {
    if (this.camera) {
      this.camera.takePicture();
    } else {
      logger.error("Can't take a picture. No camera connected");
    }
  }

  /**
   * Observes the live view.
   * @returns {Observable<Buffer>}
   */
  observeLiveView(): Observable<Buffer> {
    if (!this.camera) {
      logger.error("Can't observe live view. No camera connected");
      return throwError(() => new FotoboxError('No camera connected'));
    }
    return this.camera.observeLiveView();
  }

  /**
   * Observes the live view.
   * @returns {Observable<Buffer>}
   */
  observePictures(): Observable<string> {
    if (!this.camera) {
      logger.error("Can't observe pictures. No camera connected");
      return throwError(() => new FotoboxError('No camera connected'));
    }
    return this.camera.observePictures();
  }

  /**
   * Stops live view.
   * @returns {Observable<string>}
   */
  stopLiveView() {
    if (!this.camera) {
      logger.error("Can't stop live view. No camera connected");
      return throwError(() => new FotoboxError('No camera connected'));
    }
    this.camera.stopLiveViewObserving();
  }

  /**
   * searches in network for a connected camera via ssdp.
   * @returns {Promise<string>}
   */
  private findCamera(): Promise<string> {
    logger.info('start searching for camera');

    return new Promise((resolve) => {
      const ssdpClient = new SsdpClient();

      this.ssdpInterval = setInterval(() => {
        if (this.abortSearching) {
          logger.info('Abort searching for camera');
          ssdpClient.stop();
          if (this.ssdpInterval) {
            clearInterval(this.ssdpInterval);
          }
          return;
        }
        logger.info('call SSDP search');
        ssdpClient.stop();
        ssdpClient.start();
        ssdpClient.search(M_SEARCH_CAMERA);
      }, 1000);

      const found = (headers: SsdpHeaders) => {
        logger.info(`Found a camera: ${headers.LOCATION}`);
        ssdpClient.stop();
        if (this.ssdpInterval) clearInterval(this.ssdpInterval);
        ssdpClient.removeListener('response', found);
        resolve(headers.LOCATION!);
      };

      ssdpClient.on('response', found);
    });
  }

  /**
   * Configures the connected camera. Use camera accessable via descriptionUrl.
   * @param {ClientProxy} clientProxy
   * @param {string} descriptionUrl
   * @returns {Promise<void>}
   */
  private async initializeCamera(descriptionUrl: string) {
    this.camera = new SonyCameraCommunication(descriptionUrl);
    await this.camera.init();
  }
}
