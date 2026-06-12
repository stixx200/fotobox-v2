import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';

// GraphQL Queries
const GET_AVAILABLE_CAMERAS = gql`
  query GetAvailableCameras {
    availableCameras {
      cameras {
        driver
        status
        available
        location
        capabilities {
          liveView
        }
      }
    }
  }
`;

const GET_CAMERA_STATUS = gql`
  query GetCameraStatus {
    cameraStatus {
      driver
      status
      available
      location
      capabilities {
        liveView
      }
    }
  }
`;

// GraphQL Mutations
const INITIALIZE_CAMERA = gql`
  mutation InitializeCamera($driver: String!) {
    initializeCamera(driver: $driver) {
      success
      message
    }
  }
`;

const START_LIVE_VIEW = gql`
  mutation StartLiveView {
    startLiveView {
      success
      message
    }
  }
`;

const STOP_LIVE_VIEW = gql`
  mutation StopLiveView {
    stopLiveView {
      success
      message
    }
  }
`;

// GraphQL Subscriptions
const LIVE_VIEW_STREAM = gql`
  subscription LiveViewStream {
    liveViewStream {
      data
      timestamp
    }
  }
`;

const PICTURE_TAKEN = gql`
  subscription PictureTaken {
    pictureTaken {
      id
      path
      timestamp
    }
  }
`;

const UPLOAD_PHOTO = gql`
  mutation UploadPhoto($input: UploadPhotoInput!) {
    uploadPhoto(input: $input) {
      id
      path
      timestamp
    }
  }
`;

export type CameraLocation = 'server' | 'client';

export interface CameraCapabilities {
  liveView: boolean;
}

export interface CameraInfo {
  driver: string;
  status: string;
  available: boolean;
  location: CameraLocation;
  capabilities: CameraCapabilities;
}

export interface Picture {
  id: string;
  path: string;
  timestamp: string;
}

export interface LiveViewFrame {
  data: string;
  timestamp: string;
}

export interface MutationResult {
  success: boolean;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class CameraService {
  constructor(private apollo: Apollo) {}

  getAvailableCameras(): Observable<CameraInfo[]> {
    return this.apollo
      .query<{ availableCameras: { cameras: CameraInfo[] } }>({
        query: GET_AVAILABLE_CAMERAS,
      })
      .pipe(map((result) => result.data!.availableCameras.cameras));
  }

  getCameraStatus(): Observable<CameraInfo> {
    return this.apollo
      .query<{ cameraStatus: CameraInfo }>({
        query: GET_CAMERA_STATUS,
      })
      .pipe(map((result) => result.data!.cameraStatus));
  }

  initializeCamera(driver: string): Observable<MutationResult> {
    return this.apollo
      .mutate<{ initializeCamera: MutationResult }>({
        mutation: INITIALIZE_CAMERA,
        variables: { driver },
        refetchQueries: [{ query: GET_CAMERA_STATUS }],
      })
      .pipe(map((result) => result.data!.initializeCamera));
  }

  takePicture(): Observable<Picture> {
    return this.apollo
      .mutate<{ takePicture: Picture }>({
        mutation: gql`
          mutation TakePicture {
            takePicture {
              id
              path
              timestamp
            }
          }
        `,
      })
      .pipe(map((result) => result.data!.takePicture));
  }

  /**
   * Upload a photo captured by a client camera (browser webcam) to the server.
   * The server saves it and broadcasts a pictureTaken event.
   */
  uploadPhoto(imageData: string): Observable<Picture> {
    return this.apollo
      .mutate<{ uploadPhoto: Picture }>({
        mutation: UPLOAD_PHOTO,
        variables: { input: { imageData } },
      })
      .pipe(map((result) => result.data!.uploadPhoto));
  }

  startLiveView(): Observable<MutationResult> {
    return this.apollo
      .mutate<{ startLiveView: MutationResult }>({
        mutation: START_LIVE_VIEW,
      })
      .pipe(map((result) => result.data!.startLiveView));
  }

  stopLiveView(): Observable<MutationResult> {
    return this.apollo
      .mutate<{ stopLiveView: MutationResult }>({
        mutation: STOP_LIVE_VIEW,
      })
      .pipe(map((result) => result.data!.stopLiveView));
  }

  /**
   * Subscribe to live view frames from the camera
   */
  subscribeLiveView(): Observable<LiveViewFrame> {
    return this.apollo
      .subscribe<{ liveViewStream: LiveViewFrame }>({
        query: LIVE_VIEW_STREAM,
      })
      .pipe(map((result) => result.data!.liveViewStream));
  }

  /**
   * Subscribe to picture taken events
   */
  subscribePictureTaken(): Observable<Picture> {
    return this.apollo
      .subscribe<{ pictureTaken: Picture }>({
        query: PICTURE_TAKEN,
      })
      .pipe(map((result) => result.data!.pictureTaken));
  }
}
