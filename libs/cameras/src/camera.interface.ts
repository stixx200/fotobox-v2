import { Observable } from 'rxjs';

/**
 * Base interface for all camera implementations
 */
export interface CameraInterface {
  driver: string; // Identifier for the camera driver

  /**
   * Initialize the camera
   */
  init(): Promise<void>;

  /**
   * Deinitialize and cleanup camera resources
   */
  deinit(): Promise<void>;

  /**
   * Trigger camera to take a picture
   * The picture URL will be emitted via observePictures()
   */
  takePicture(): Promise<void>;

  /**
   * Observe live view frames from the camera
   * Returns base64 encoded JPEG images
   */
  observeLiveView(): Observable<string>;

  /**
   * Observe pictures taken by the camera
   * Returns picture IDs or URLs
   */
  observePictures(): Observable<string>;

  /**
   * Stop live view streaming
   */
  stopLiveView(): Promise<void>;

  /**
   * Get camera availability status
   */
  isAvailable(): boolean;
}
