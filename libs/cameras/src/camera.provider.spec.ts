import { describe, expect, it } from 'vitest';
import { CameraFactory, WEBCAM_DRIVER } from './camera.provider';

describe('CameraFactory', () => {
  it('describes server drivers and the client webcam source', () => {
    const cameras = CameraFactory.describeCameras();
    expect(cameras.some((camera) => camera.driver === WEBCAM_DRIVER)).toBe(
      true,
    );
    expect(cameras.some((camera) => camera.driver === 'demo')).toBe(true);
  });

  it('throws FotoboxError for unknown drivers', () => {
    expect(() => CameraFactory.createCamera('unknown-driver')).toThrow(
      /Camera driver 'unknown-driver' not available/,
    );
  });

  it('creates a demo camera instance', () => {
    const camera = CameraFactory.createCamera('demo');
    expect(camera).toBeDefined();
  });
});
