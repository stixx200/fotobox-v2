import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// GraphQL Queries
const GET_AVAILABLE_CAMERAS = gql`
  query GetAvailableCameras {
    availableCameras {
      cameras {
        driver
        status
        available
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

const TAKE_PICTURE = gql`
  mutation TakePicture {
    takePicture {
      id
      path
      timestamp
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

export interface CameraInfo {
  driver: string;
  status: string;
  available: boolean;
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
        mutation: TAKE_PICTURE,
      })
      .pipe(map((result) => result.data!.takePicture));
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
