import { Field, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CameraCapabilities {
  @Field(() => Boolean)
  liveView!: boolean;
}

@ObjectType()
export class CameraInfo {
  @Field(() => String)
  driver!: string;

  @Field(() => String)
  status!: string;

  @Field(() => Boolean)
  available!: boolean;

  @Field(() => String, {
    description: "Where the camera runs: 'server' or 'client'.",
  })
  location!: string;

  @Field(() => CameraCapabilities)
  capabilities!: CameraCapabilities;
}

@ObjectType()
export class CameraList {
  @Field(() => [CameraInfo])
  cameras!: CameraInfo[];
}

@InputType()
export class UploadPhotoInput {
  @Field(() => String, {
    description: 'Base64-encoded JPEG image data (with or without data URI).',
  })
  imageData!: string;
}

@ObjectType()
export class Picture {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  path!: string;

  @Field(() => String)
  timestamp!: string;
}

@ObjectType()
export class LiveViewFrame {
  @Field(() => String)
  data!: string; // Base64 encoded image data

  @Field(() => String)
  timestamp!: string;
}
