import { getLogger } from '@fotobox/logging';
import { CameraInterface } from './camera.interface';
import { DemoCamera } from './demo';
import { SonyCamera } from './sony';

const logger = getLogger('camera.factory');

/**
 * Available camera drivers
 */
export const CAMERA_DRIVERS = {
  demo: DemoCamera,
  sony: SonyCamera,
} as const;

export type CameraDriverType = keyof typeof CAMERA_DRIVERS;

/**
 * Camera factory to create camera instances by driver name
 */
export class CameraFactory {
  /**
   * Get list of available camera driver names
   */
  static getAvailableDrivers(): string[] {
    return Object.keys(CAMERA_DRIVERS);
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
        `Camera driver '${driver}' not available. Available drivers: ${this.getAvailableDrivers().join(', ')}`
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
