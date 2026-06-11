import { getLogger } from '@fotobox/logging';
import {
  CameraInterface,
  CameraDescriptor,
  CameraCapabilities,
} from './camera.interface';
import { DemoCamera } from './demo';
import { SonyCamera } from './sony';
import { Gphoto2Camera } from './gphoto2';

const logger = getLogger('camera.factory');

/**
 * Available server-side camera drivers
 */
export const CAMERA_DRIVERS = {
  demo: DemoCamera,
  sony: SonyCamera,
  gphoto2: Gphoto2Camera,
} as const;

export type CameraDriverType = keyof typeof CAMERA_DRIVERS;

/**
 * Identifier for the browser-driven webcam source. It has no server-side
 * implementation — the browser captures frames and uploads the photo.
 */
export const WEBCAM_DRIVER = 'webcam';

const SERVER_DRIVER_CAPABILITIES: Record<CameraDriverType, CameraCapabilities> =
  {
    demo: { liveView: true },
    sony: { liveView: true },
    gphoto2: { liveView: true },
  };

/**
 * Camera factory to create camera instances by driver name
 */
export class CameraFactory {
  /**
   * Get list of available server camera driver names
   */
  static getAvailableDrivers(): string[] {
    return Object.keys(CAMERA_DRIVERS);
  }

  /**
   * Describe every selectable camera source (server drivers + the client
   * webcam) so the UI can present and adapt to them.
   */
  static describeCameras(): CameraDescriptor[] {
    const serverCameras: CameraDescriptor[] = Object.keys(CAMERA_DRIVERS).map(
      (driver) => ({
        driver,
        location: 'server',
        capabilities: SERVER_DRIVER_CAPABILITIES[driver as CameraDriverType],
        available: CameraFactory.isServerDriverAvailable(driver),
      }),
    );

    const webcam: CameraDescriptor = {
      driver: WEBCAM_DRIVER,
      location: 'client',
      capabilities: { liveView: true },
      available: true,
    };

    return [...serverCameras, webcam];
  }

  /**
   * Best-effort static availability check for a server driver without
   * instantiating/initializing it. Drivers without a cheap check default to
   * available and surface errors at init time.
   */
  static isServerDriverAvailable(driver: string): boolean {
    const driverKey = driver.toLowerCase();
    if (driverKey === 'gphoto2') {
      return Gphoto2Camera.isBinaryAvailable();
    }
    return driverKey in CAMERA_DRIVERS;
  }

  /**
   * Create a camera instance by driver name
   * @param driver - The camera driver name (e.g., 'demo', 'sony')
   * @returns Camera instance
   * @throws Error if driver is not available
   */
  static createCamera(driver: string): CameraInterface {
    const driverKey = driver.toLowerCase() as CameraDriverType;

    if (!CAMERA_DRIVERS[driverKey]) {
      throw new Error(
        `Camera driver '${driver}' not available. Available drivers: ${this.getAvailableDrivers().join(', ')}`,
      );
    }

    logger.info(`Creating camera instance for driver: ${driver}`);
    const CameraClass = CAMERA_DRIVERS[driverKey];
    return new CameraClass();
  }

  /**
   * Check if a driver is available
   * @param driver - The camera driver name
   * @returns true if driver is available
   */
  static isDriverAvailable(driver: string): boolean {
    return driver.toLowerCase() in CAMERA_DRIVERS;
  }
}
