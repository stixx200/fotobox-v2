import * as http from 'http';
import { ClientRequest, IncomingMessage } from 'http';
import { Observable, Observer, Subject } from 'rxjs';
import axios from 'axios';
import { parseString as xml2jsParseString } from 'xml2js';
import { promisify } from 'util';
import { getLogger } from '@fotobox/logging';
import { CameraProxy } from './camera.proxy';
import { LiveStreamParser } from './liveStream.parser';

const logger = getLogger('camera.sony.communication');

const parseString = promisify(xml2jsParseString);

/** Subset of the UPnP device description (xml2js output) Fotobox reads. */
interface SonyServiceEntry {
  'av:X_ScalarWebAPI_ServiceType': string[];
  'av:X_ScalarWebAPI_ActionList_URL': string[];
}

interface SonyDeviceDescription {
  root: {
    device: Array<{
      friendlyName: string[];
      manufacturer: string[];
      'av:X_ScalarWebAPI_DeviceInfo': Array<{
        'av:X_ScalarWebAPI_ServiceList': Array<{
          'av:X_ScalarWebAPI_Service': SonyServiceEntry[];
        }>;
      }>;
    }>;
  };
}

interface SonyStatusEvent {
  type: string;
  takePictureUrl?: string[];
}

function errorText(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message;
  }
  return String(error);
}

export class SonyCameraCommunication {
  public name!: string;
  public manufacturer!: string;

  public pictureUrl$ = new Subject<string>();
  private cameraProxy!: CameraProxy;
  private liveviewRequest?: ClientRequest;
  private statusObservation = false;

  constructor(private descriptionUrl: string) {}

  async init() {
    const response = await axios.get(this.descriptionUrl);
    const description = (await parseString(
      response.data,
    )) as SonyDeviceDescription;

    const device = description.root.device[0];
    const serviceList =
      device['av:X_ScalarWebAPI_DeviceInfo'][0][
        'av:X_ScalarWebAPI_ServiceList'
      ][0]['av:X_ScalarWebAPI_Service'];

    this.name = device.friendlyName[0];
    this.manufacturer = device.manufacturer[0];
    const services = serviceList.map((data) => ({
      type: data['av:X_ScalarWebAPI_ServiceType'][0],
      url: `${data['av:X_ScalarWebAPI_ActionList_URL'][0]}/${data['av:X_ScalarWebAPI_ServiceType'][0]}`,
    }));
    this.cameraProxy = new CameraProxy(services);

    await this.initializeCamera();
  }

  async deinit() {
    this.statusObservation = false;
    try {
      this.stopLiveViewObserving();
      await this.cameraProxy.call('camera', 'stopRecMode');
    } catch (error) {
      logger.error(`Can't stopRecMode on camera: ${error}`);
    }
  }

  async takePicture() {
    const [results] = await this.cameraProxy.call(
      'camera',
      'actTakePicture',
      [],
      '1.0',
    );
    this.pictureUrl$.next(results[0]);
  }

  observePictures(): Observable<string> {
    logger.info('Observe pictures');
    return this.pictureUrl$;
  }

  observeLiveView(): Observable<string> {
    logger.info('Observe liveview');
    return Observable.create((observer: Observer<string>) => {
      const bufferObserver: Observer<Buffer> = {
        next: (buffer: Buffer) => {
          // Convert buffer to base64 string
          const base64 = buffer.toString('base64');
          observer.next(base64);
        },
        error: (err) => observer.error(err),
        complete: () => observer.complete(),
      };

      const liveStreamParser = new LiveStreamParser(bufferObserver);
      this.cameraProxy
        .call('camera', 'startLiveviewWithSize', ['L'])
        .then(([liveViewUrl]) => {
          this.liveviewRequest = http.get(
            liveViewUrl,
            (res: IncomingMessage) => {
              res.on('data', (chunk: Buffer) => {
                liveStreamParser.onNewChunk(chunk);
              });
              res.on('end', () => {
                observer.complete();
              });
              res.on('error', (error) => {
                observer.error(error);
              });
            },
          );
        });
    });
  }

  stopLiveViewObserving() {
    if (this.liveviewRequest) {
      this.liveviewRequest.abort();
    }
  }

  private async initializeCamera() {
    // start rec mode
    await this.cameraProxy.call('camera', 'startRecMode');

    this.startCameraStatusObservation();

    // set shoot mode to still pictures (no movies)
    setTimeout(async () => {
      try {
        const shootmode = await this.cameraProxy.call(
          'camera',
          'getShootMode',
          [],
          '1.0',
        );
        if (shootmode[0] !== 'still') {
          await this.cameraProxy.call(
            'camera',
            'setShootMode',
            ['still'],
            '1.0',
          );
        }
      } catch (error) {
        logger.error("failed to set shootmode to 'still': " + errorText(error));
      }
    }, 1000);
  }

  private async startCameraStatusObservation() {
    const initialResult = await this.cameraProxy.call(
      'camera',
      'getEvent',
      [false],
      '1.3',
    );
    this.newStatusReceived(initialResult);

    this.statusObservation = true;
    do {
      try {
        const result = await this.cameraProxy.call(
          'camera',
          'getEvent',
          [true],
          '1.3',
        );
        this.newStatusReceived(result);
        await new Promise((r) => setTimeout(r, 200));
      } catch (error) {
        if (error instanceof Error && /Timed out/.test(error.message)) {
          continue;
        }
        logger.error(
          `An error occured while getEvent request to camera: ${JSON.stringify(
            error,
          )}`,
        );
        this.statusObservation = false;
        // Note: shutdownHandler was removed - errors are just logged
      }
    } while (this.statusObservation);
  }

  private newStatusReceived(
    input: Array<SonyStatusEvent | SonyStatusEvent[] | null>,
  ) {
    const compacted = input.filter((item) => item != null);
    const newStatus = compacted.flat();
    logger.debug(`Received new status: ${JSON.stringify(newStatus)}`);

    newStatus.forEach((status) => {
      this.parseStatus(status.type, status);
    });
  }

  private parseStatus(type: string, status: SonyStatusEvent) {
    switch (type) {
      case 'takePicture': {
        const takePictureUrl = status.takePictureUrl?.[0];
        if (!takePictureUrl) {
          logger.warn('takePicture event without a picture URL');
          break;
        }
        logger.info(`Got new picture url: ${takePictureUrl}`);
        this.pictureUrl$.next(takePictureUrl);
        break;
      }
      default:
        break;
    }
  }
}
