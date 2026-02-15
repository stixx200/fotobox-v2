import { Field, ObjectType, InputType, Int } from '@nestjs/graphql';

@ObjectType()
export class CollageTemplate {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => Int)
  photoCount!: number;

  @Field(() => String, { nullable: true })
  description?: string;
}

@ObjectType()
export class CollageStatus {
  @Field(() => String)
  templateId!: string;

  @Field(() => Int)
  photoCount!: number;

  @Field(() => Int)
  requiredPhotoCount!: number;

  @Field(() => Boolean)
  complete!: boolean;

  @Field(() => [String])
  photos!: string[];
}

@ObjectType()
export class CollageOutput {
  @Field(() => String)
  data!: string; // Base64 encoded image

  @Field(() => Boolean)
  done!: boolean;
}

@InputType()
export class CreateCollageInput {
  @Field(() => String)
  templateId!: string;
}

@InputType()
export class AddPhotoInput {
  @Field(() => String)
  photoPath!: string;
}
