import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ShareLink {
  @Field()
  url!: string;

  @Field()
  token!: string;

  @Field()
  expiresAt!: string;
}
