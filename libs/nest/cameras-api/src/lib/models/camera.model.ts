import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CameraInfo {
  @Field(() => String)
  driver!: string;

  @Field(() => String)
  status!: string;

  @Field(() => Boolean)
  available!: boolean;
}

@ObjectType()
export class CameraList {
  @Field(() => [CameraInfo])
  cameras!: CameraInfo[];
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
