import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CollageEditorProjectSummaryModel {
  @Field()
  id!: string;

  @Field({ nullable: true })
  name?: string;

  @Field(() => Int)
  width!: number;

  @Field(() => Int)
  height!: number;

  @Field({ nullable: true })
  updatedAt?: string;

  @Field({ nullable: true })
  thumbnailBase64?: string;
}

@ObjectType()
export class CollageEditorProjectModel {
  @Field(() => Int)
  version!: number;

  @Field()
  id!: string;

  @Field({ nullable: true })
  name?: string;

  @Field(() => Int)
  width!: number;

  @Field(() => Int)
  height!: number;

  @Field({ nullable: true })
  borderJson?: string;

  @Field()
  fabricJson!: string;

  @Field()
  layerMetaJson!: string;
}

@ObjectType()
export class DeleteCollageEditorProjectResult {
  @Field()
  templateId!: string;
}

@ObjectType()
export class DuplicateCollageEditorProjectResult {
  @Field()
  templateId!: string;

  @Field()
  name!: string;
}

@ObjectType()
export class CollageEditorValidationResult {
  @Field()
  valid!: boolean;

  @Field({ nullable: true })
  previewBase64?: string;

  @Field({ nullable: true })
  message?: string;
}

@ObjectType()
export class SaveCollageEditorProjectResult {
  @Field()
  templateId!: string;

  @Field()
  path!: string;
}

@InputType()
export class CollageEditorAssetInput {
  @Field()
  filename!: string;

  @Field()
  base64!: string;
}

@InputType()
export class SaveCollageEditorProjectInput {
  @Field()
  projectJson!: string;

  @Field()
  backgroundBase64!: string;

  @Field(() => [CollageEditorAssetInput], { nullable: true })
  assets?: CollageEditorAssetInput[];

  @Field({ nullable: true })
  collageDirectory?: string;

  @Field({ nullable: true, defaultValue: false })
  overwrite?: boolean;
}
