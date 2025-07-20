import * as _ from "lodash";
import { Observable } from "rxjs";
import { flatMap } from "rxjs/operators";
import { promisify } from "util";
import * as wifi from "wifi-control";
import { CameraInitConfiguration } from "../../../shared/init-configuration.interface";
import { ClientProxy } from "../../client.proxy";
import { FotoboxError } from "../../error/fotoboxError";
import { PhotoHandler } from "../../photo.handler";
import {ShutdownHandler} f'../../shutdown.handler'ler";
import {CameraInterface} f'../camera.interface'ace";
import {SonyCameraCommunication} f'./camera'era";

const logger = require("logger-winston").getLogger("camera.sony");

const { Client: SsdpClient } = require("node-ssdp");

const M_SEARCH_CAMERA = "urn:schemas-sony-com:service:ScalarWebAPI:1";
const SUPPORTED_CAMERA_NETWORKS = ["ILCE-6000"];

const findSupportedNetwork = (networks) => {
  let found = null;
  networks.forEach((network) => {
    if (
      !!_.find(SUPPORTED_CAMERA_NETWORKS, (supportedNetwork) => _.includes(network.ssid, supportedNetwork))
    ) {
      found = network;
    }
  });
  return found;
};

/**
 * Sony Camera
 */
export class SonyCamera implements CameraInterface {
  shutdownHandler: ShutdownHandler = null;
  camera: SonyCameraCommunication;
  photosaver: PhotoHandler;
  clientProxy: ClientProxy;

  private isInitialized = false;

  private ssdpInterval: any;

  private abortSearching = false;

  private config: CameraInitConfiguration;
  private wifiConnected = false;

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
    if (config.wifiControl && !config.sonyPassword) {
      throw new FotoboxError(
        'Can\'t start application, because WIFI Control is enabled, but no Sony WIFI Password is set.',
        'MAIN.CAMERAS.SONY.PASSWORD_MISSING',
      );
    }

    this.abortSearching = false;
    this.photosaver = externals.photosaver;
    this.shutdownHandler = externals.shutdownHandler;
    this.clientProxy = externals.clientProxy;
    this.config = config;

    if (this.isInitialized) {
      await this.deinit();
    }

    if (this.config.wifiControl) {
      await this.connectWifi();
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
    clearInterval(this.ssdpInterval);
    this.ssdpInterval = null;

    logger.info('destroy camera');
    if (this.camera) {
      await this.camera.deinit();
    }
    this.camera = null;

    // disconnect from camera
    if (this.wifiConnected) {
      const {success, msg} = await promisify(wifi.resetWiFi)();
      if (!success) {
        logger.error(msg);
      }
      this.wifiConnected = false;
    }
  }

  /**
   * Takes a picture. The new picture is published via picture observer
   */
  takePicture(): void {
    if (this.camera) {
      this.camera.takePicture();
    } else {
      logger.error('Can\'t take a picture. No camera connected');
      this.clientProxy.sendError('Can\'t take a picture. No camera connected');
    }
  }

  /**
   * Observes the live view.
   * @returns {Observable<Buffer>}
   */
  observeLiveView(): Observable<Buffer> {
    return this.camera.observeLiveView();
  }

  /**
   * Observes the live view.
   * @returns {Observable<Buffer>}
   */
  observePictures(): Observable<string> {
    return this.camera.pictureUrl$.pipe(flatMap((url: string) => this.photosaver.downloadAndSave(url)));
  }

  /**
   * Stops live view.
   * @returns {Observable<string>}
   */
  stopLiveView() {
    this.camera.stopLiveViewObserving();
  }

  /**
   * connects to cameras wifi
   * @returns {Promise<void>}
   */
  private async connectWifi() {
    this.clientProxy.sendStatus('PAGES.SETUP.FOTOBOX.MODAL.STATUS_CONNECTING_CAMERA');
    logger.info('start connecting to Wifi');

    // initialize wifi interface
    wifi.init();
    const {interface: iface} = wifi.findInterface();
    wifi.configure({debug: true, iface});

    // find wifi network to connect
    let sonyWifiInterface = null;
    do {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (this.abortSearching) {
        throw new Error('searching for wifi aborted');
      }
      logger.debug('Scan for wifi networks');
      const {success, networks, msg} = await promisify(wifi.scanForWiFi)();
      if (!success) {
        logger.error(msg);
        this.clientProxy.sendStatus(msg);
      }

      logger.info(`Available networks: ${_.map(networks, (network) => network.ssid)}`);
      sonyWifiInterface = findSupportedNetwork(networks);
    } while (sonyWifiInterface === null);

    // check if we have to connect to the network or if we are already connected
    const ifaceState = wifi.getIfaceState();
    if (
      !ifaceState.success ||
      ifaceState.connection !== 'connected' ||
      ifaceState.ssid !== sonyWifiInterface.ssid
    ) {
      // connect to found camera network
      const {success: connectSuccess, msg: connectMsg} = await promisify(wifi.connectToAP)({
        ssid: sonyWifiInterface.ssid,
        password: this.config.sonyPassword,
      });

      if (!connectSuccess) {
        logger.error(connectMsg);
        throw new Error(connectMsg);
      }
    }

    this.wifiConnected = true;
  }

  /**
   * searches in network for a connected camera via ssdp.
   * @returns {Promise<string>}
   */
  private findCamera(): Promise<string> {
    this.clientProxy.sendStatus('PAGES.SETUP.FOTOBOX.MODAL.STATUS_SEARCHING_CAMERA');
    logger.info('start searching for camera');

    return new Promise((resolve) => {
      const ssdpClient = new SsdpClient();

      this.ssdpInterval = setInterval(() => {
        logger.info('call SSDP search');
        ssdpClient.stop();
        ssdpClient.start();
        ssdpClient.search(M_SEARCH_CAMERA);
      }, 1000);

      const found = (headers: { LOCATION: string }) => {
        logger.info(`Found a camera: ${headers.LOCATION}`);
        ssdpClient.stop();
        clearInterval(this.ssdpInterval);
        ssdpClient.removeListener('response', found);
        resolve(headers.LOCATION);
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
    await this.camera.init({shutdownHandler: this.shutdownHandler});
  }
}
