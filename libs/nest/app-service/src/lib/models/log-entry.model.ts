import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class LogEntry {
  @Field()
  timestamp!: string;

  @Field()
  level!: string;

  @Field()
  message!: string;

  @Field({ nullable: true })
  context?: string;

  @Field({ nullable: true })
  metaJson?: string;
}

@ObjectType()
export class LogList {
  @Field(() => [LogEntry])
  entries!: LogEntry[];

  @Field(() => Int)
  total!: number;
}
