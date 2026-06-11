import { ObjectType, Field } from '@nestjs/graphql';

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
