import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DirectoryEntry {
  @Field(() => String)
  name!: string;

  @Field(() => String)
  path!: string;
}

@ObjectType()
export class DirectoryListing {
  /** Absolute path of the listed directory. */
  @Field(() => String)
  path!: string;

  /** Parent directory, or null at a filesystem root. */
  @Field(() => String, { nullable: true })
  parent?: string | null;

  /** Visible subdirectories, sorted by name. */
  @Field(() => [DirectoryEntry])
  entries!: DirectoryEntry[];

  /** Drives (Windows) or `/` and the home directory, for quick navigation. */
  @Field(() => [String])
  roots!: string[];
}
