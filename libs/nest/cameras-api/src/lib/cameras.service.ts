import { Injectable } from '@nestjs/common';
import { getLogger } from '@fotobox/logging';
import { CameraInfo } from './models/camera.model';

const logger = getLogger('CameraService');

@Injectable()
export class CameraService {
  private currentDriver: string | null = null;
  private isInitialized = false;

  async getAvailableCameras(): Promise<CameraInfo[]> {
    logger.debug('Fetching available cameras');
    
    // Return available camera drivers
    // In the future, this will integrate with the actual camera library
    return [
      {
        driver: 'demo',
        status: 'available',
        available: true,
      },
      {
        driver: 'sony',
        status: 'not configured',
        available: false,
      },
    ];
  }

  async getCameraStatus(): Promise<CameraInfo> {
    logger.debug('Fetching camera status');
    
    if (!this.currentDriver) {
      return {
        driver: 'none',
        status: 'not initialized',
        available: false,
      };
    }

    return {
      driver: this.currentDriver,
      status: this.isInitialized ? 'active' : 'initializing',
      available: this.isInitialized,
    };
  }

  async initializeCamera(driver: string): Promise<boolean> {
    logger.info(`Initializing camera with driver: ${driver}`);
    
    // Validate driver
    const availableCameras = await this.getAvailableCameras();
    const camera = availableCameras.find(c => c.driver === driver && c.available);
    
    if (!camera) {
      throw new Error(`Camera driver '${driver}' is not available`);
    }

    this.currentDriver = driver;
    this.isInitialized = true;
    
    return true;
  }

  async takePicture(): Promise<string> {
    logger.info('Taking picture');
    
    if (!this.isInitialized) {
      throw new Error('Camera not initialized');
    }

    // Simulate taking a picture
    // In the future, this will integrate with the actual camera library
    const pictureId = `picture-${Date.now()}`;
    
    return pictureId;
  }
}
