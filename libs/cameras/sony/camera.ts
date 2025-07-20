import * as http from "http";
import { ClientRequest, IncomingMessage } from "http";
import * as _ from "lodash";
import { Observable, Observer, Subject } from "rxjs";
import { FotoboxError } from "../../error/fotoboxError";
import { ShutdownHandler } from "../../shutdown.handler";
import { CameraProxy } from "./camera.proxy";
import { LiveStreamParser } from "./liveStream.parser";

const request = require("superagent");
const xml2jsParseString = require("xml2js").parseString;

const { promisify } = require("util");
const logger = require("logger-winston").getLogger("camera.sony.communication");

const parseString = promisify(xml2jsParseString);

export class SonyCameraCommunication {
  public name: string;
  public manufacturer: string;

  public pictureUrl$ = new Subject<string>();
  private cameraProxy: CameraProxy;
  private shutdownHandler: ShutdownHandler;
  private liveviewRequest: ClientRequest;
  private statusObservation = false;

  constructor(private descriptionUrl: string) {}

  async init({ shutdownHandler }: { shutdownHandler: ShutdownHandler }) {
    this.shutdownHandler = shutdownHandler;
    const response = await request.get(this.descriptionUrl);
    const description = await parseString(response.text);

    const device = description.root.device[0];
    const serviceList =
      device["av:X_ScalarWebAPI_DeviceInfo"][0]["av:X_ScalarWebAPI_ServiceList"][0][
        "av:X_ScalarWebAPI_Service"
      ];

    this.name = device.friendlyName[0];
    this.manufacturer = device.manufacturer;
    const services = _.map(serviceList, (data) => ({
      type: data["av:X_ScalarWebAPI_ServiceType"][0],
      url: `${data["av:X_ScalarWebAPI_ActionList_URL"][0]}/${data["av:X_ScalarWebAPI_ServiceType"][0]}`,
    }));
    this.cameraProxy = new CameraProxy(services);

    await this.initializeCamera();
  }

  async deinit() {
    this.statusObservation = false;
    try {
      this.stopLiveViewObserving();
      await this.cameraProxy.call("camera", "stopRecMode");
    } catch (error) {
      logger.error(`Can't stopRecMode on camera: ${error}`);
    }
  }

  async takePicture() {
    const [results] = await this.cameraProxy.call("camera", "actTakePicture", [], "1.0");
    this.pictureUrl$.next(results[0]);
  }

  observeLiveView(): Observable<Buffer> {
    logger.info("Observe liveview");
    return Observable.create((observer: Observer<Buffer>) => {
      const liveStreamParser = new LiveStreamParser(observer);
      this.cameraProxy.call("camera", "startLiveviewWithSize", ["L"]).then(([liveViewUrl]) => {
        this.liveviewRequest = http.get(liveViewUrl, (res: IncomingMessage) => {
          res.on("data", (chunk: Buffer) => {
            liveStreamParser.onNewChunk(chunk);
          });
          res.on("end", () => {
            observer.complete();
          });
          res.on("error", (error) => {
            observer.error(error);
          });
        });
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
    await this.cameraProxy.call("camera", "startRecMode");

    this.startCameraStatusObservation();

    // set shoot mode to still pictures (no movies)
    setTimeout(async () => {
      try {
        const shootmode = await this.cameraProxy.call("camera", "getShootMode", [], "1.0");
        if (shootmode[0] !== "still") {
          await this.cameraProxy.call("camera", "setShootMode", ["still"], "1.0");
        }
      } catch (error) {
        logger.error("failed to set shootmode to 'still': " + error.stack);
      }
    }, 1000);
  }

  private async startCameraStatusObservation() {
    const initialResult = await this.cameraProxy.call("camera", "getEvent", [false], "1.3");
    this.newStatusReceived(initialResult);

    this.statusObservation = true;
    do {
      try {
        const result = await this.cameraProxy.call("camera", "getEvent", [true], "1.3");
        this.newStatusReceived(result);
        await new Promise((r) => setTimeout(r, 200));
      } catch (error) {
        if (error.message.match(/Timed out/)) {
          continue;
        }
        logger.error(`An error occured while getEvent request to camera: ${JSON.stringify(error)}`);
        this.statusObservation = false;
        this.shutdownHandler.publishError(new FotoboxError(error));
      }
    } while (this.statusObservation);
  }

  private newStatusReceived(input: any[]) {
    const newStatus = _.flatten(_.compact(input));
    logger.debug(`Received new status: ${JSON.stringify(newStatus)}`);

    _.forEach(newStatus, (status) => {
      this.parseStatus(status.type, status);
    });
  }

  private parseStatus(type: string, status: any) {
    switch (type) {
      case "takePicture":
        const takePictureUrl = status.takePictureUrl[0];
        logger.info(`Got new picture url: ${takePictureUrl}`);
        this.pictureUrl$.next(takePictureUrl);
        break;
      default:
        break;
    }
  }
}
