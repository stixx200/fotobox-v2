import {
  spawn,
  spawnSync,
  ChildProcessWithoutNullStreams,
} from 'child_process';
import { Observable, Subject } from 'rxjs';
import { getLogger } from '@fotobox/logging';
import { CameraInterface } from '../camera.interface';

const logger = getLogger('camera.gphoto2');

const GPHOTO2_BIN = process.env.GPHOTO2_BIN || 'gphoto2';
const LIVE_VIEW_INTERVAL_MS = Number(process.env.GPHOTO2_PREVIEW_MS) || 400;

/**
 * Camera driver for DSLR/mirrorless cameras controlled via the `gphoto2` CLI.
 *
 * Live view is implemented by repeatedly capturing preview frames
 * (`gphoto2 --capture-preview`). Capture uses
 * `gphoto2 --capture-image-and-download`. Both stream binary JPEG to stdout.
 *
 * Availability depends on the `gphoto2` binary being installed and a camera
 * being connected, so this driver typically reports unavailable on Windows.
 */
export class Gphoto2Camera implements CameraInterface {
  public driver = 'gphoto2';

  private liveViewSubject = new Subject<string>();
  private picturesSubject = new Subject<string>();
  private liveViewTimer: ReturnType<typeof setInterval> | null = null;
  private capturingPreview = false;
  private available = false;

  /**
   * Whether the gphoto2 binary is installed on this host.
   */
  static isBinaryAvailable(): boolean {
    try {
      const result = spawnSync(GPHOTO2_BIN, ['--version'], {
        timeout: 5000,
      });
      return result.status === 0;
    } catch {
      return false;
    }
  }

  /**
   * Whether the binary is present AND a camera is detected.
   */
  static isCameraDetected(): boolean {
    if (!Gphoto2Camera.isBinaryAvailable()) {
      return false;
    }
    try {
      const result = spawnSync(GPHOTO2_BIN, ['--auto-detect'], {
        timeout: 8000,
        encoding: 'utf-8',
      });
      if (result.status !== 0 || !result.stdout) {
        return false;
      }
      // Output has a header + separator line; any further line means a camera.
      const lines = result.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      return lines.length > 2;
    } catch {
      return false;
    }
  }

  async init(): Promise<void> {
    this.available = Gphoto2Camera.isCameraDetected();
    if (!this.available) {
      throw new Error(
        'gphoto2 camera not available (binary missing or no camera detected)',
      );
    }
    logger.info('gphoto2 camera initialized');
  }

  async deinit(): Promise<void> {
    await this.stopLiveView();
    this.available = false;
    logger.info('gphoto2 camera deinitialized');
  }

  async takePicture(): Promise<void> {
    logger.info('Capturing image via gphoto2');
    const wasStreaming = this.liveViewTimer !== null;
    // gphoto2 cannot capture preview and a full image simultaneously.
    if (wasStreaming) {
      await this.stopLiveView();
    }

    try {
      const buffer = await this.runBinaryCapture([
        '--capture-image-and-download',
        '--stdout',
        '--force-overwrite',
      ]);
      this.picturesSubject.next(buffer.toString('base64'));
    } catch (error) {
      logger.error('Failed to capture image:', error);
      this.picturesSubject.error(error);
    }
  }

  observeLiveView(): Observable<string> {
    logger.info('Starting gphoto2 live view');
    if (this.liveViewTimer) {
      return this.liveViewSubject;
    }

    this.liveViewTimer = setInterval(() => {
      void this.capturePreviewFrame();
    }, LIVE_VIEW_INTERVAL_MS);

    return this.liveViewSubject;
  }

  observePictures(): Observable<string> {
    return this.picturesSubject;
  }

  async stopLiveView(): Promise<void> {
    if (this.liveViewTimer) {
      clearInterval(this.liveViewTimer);
      this.liveViewTimer = null;
      logger.info('gphoto2 live view stopped');
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  private async capturePreviewFrame(): Promise<void> {
    if (this.capturingPreview) {
      return; // Skip if the previous preview hasn't finished yet.
    }
    this.capturingPreview = true;
    try {
      const buffer = await this.runBinaryCapture([
        '--capture-preview',
        '--stdout',
        '--force-overwrite',
      ]);
      if (buffer.length > 0) {
        this.liveViewSubject.next(buffer.toString('base64'));
      }
    } catch (error) {
      logger.warn('Preview frame capture failed:', error);
    } finally {
      this.capturingPreview = false;
    }
  }

  private runBinaryCapture(args: string[]): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      let child: ChildProcessWithoutNullStreams;
      try {
        child = spawn(GPHOTO2_BIN, args);
      } catch (error) {
        reject(error);
        return;
      }

      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];

      child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => errChunks.push(chunk));
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(
            new Error(
              `gphoto2 exited with code ${code}: ${Buffer.concat(errChunks).toString('utf-8')}`,
            ),
          );
        }
      });
    });
  }
}
