import { Observable } from 'rxjs';

export interface CameraInterface {
  init(): Promise<void>;

  deinit(): Promise<void>;

  takePicture(): void;

  observeLiveView(): Observable<Buffer>;

  observePictures(): Observable<string>;
}
