import { Field, ObjectType, InterfaceType } from '@nestjs/graphql';

/**
 * Base interface for mutation results
 */
@InterfaceType()
export abstract class MutationResult {
  @Field(() => Boolean)
  success!: boolean;

  @Field(() => String, { nullable: true })
  message?: string;
}

/**
 * Generic mutation result implementation
 */
@ObjectType({ implements: () => [MutationResult] })
export class GenericMutationResult implements MutationResult {
  @Field(() => Boolean)
  success!: boolean;

  @Field(() => String, { nullable: true })
  message?: string;
}

/**
 * Error type for GraphQL responses
 */
@ObjectType()
export class GraphQLError {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  message!: string;

  @Field(() => String, { nullable: true })
  path?: string;
}
