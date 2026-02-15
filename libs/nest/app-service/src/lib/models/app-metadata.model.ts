import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AppMetadata {
  @Field(() => String)
  version!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  platform!: string;

  @Field(() => String, { nullable: true })
  environment?: string;
}
