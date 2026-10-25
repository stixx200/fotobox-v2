import { Field, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType('Printer')
export class PrinterInfo {
  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  state?: string;

  @Field({ nullable: true })
  isDefault?: boolean;
}

@ObjectType('PrinterList')
export class PrinterList {
  @Field(() => [PrinterInfo])
  items!: PrinterInfo[];

  @Field()
  count!: number;
}

@InputType()
export class PrintPhotoInput {
  /** File name of a photo in the photo directory, e.g. `photo-123.jpg`. */
  @Field()
  filename!: string;

  @Field({ nullable: true })
  printerName?: string;

  @Field({ nullable: true, defaultValue: true })
  landscape?: boolean;
}

@ObjectType()
export class PrintResult {
  @Field()
  success!: boolean;

  @Field({ nullable: true })
  message?: string;
}
