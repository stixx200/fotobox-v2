import { Observable } from 'rxjs';

/**
 * Where a camera is operated.
 * - `server`: driven by the backend (Sony, gphoto2, demo, ...).
 * - `client`: driven in the browser (webcam via getUserMedia). The server only
 *   receives the resulting photo via the upload API.
 */
export type CameraLocation = 'server' | 'client';

/**
 * Optional feature flags advertised per camera so the UI can adapt.
 */
export interface CameraCapabilities {
  /** Whether the camera can provide a live preview stream. */
  liveView: boolean;
}

/**
 * Static description of a selectable camera source, independent of an
 * initialized instance. Used to advertise available cameras to clients.
 */
export interface CameraDescriptor {
  driver: string;
  location: CameraLocation;
  capabilities: CameraCapabilities;
  available: boolean;
}

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
