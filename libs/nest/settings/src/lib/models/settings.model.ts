import { Field, ObjectType, InputType } from '@nestjs/graphql';

@ObjectType()
export class Setting {
  @Field(() => String)
  key!: string;

  @Field(() => String)
  value!: string;

  @Field(() => String, { nullable: true })
  description?: string;
}

@ObjectType()
export class Settings {
  @Field(() => [Setting])
  items!: Setting[];
}

@InputType()
export class SettingInput {
  @Field(() => String)
  key!: string;

  @Field(() => String)
  value!: string;
}

@InputType()
export class SettingsInput {
  @Field(() => [SettingInput])
  settings!: SettingInput[];
}
