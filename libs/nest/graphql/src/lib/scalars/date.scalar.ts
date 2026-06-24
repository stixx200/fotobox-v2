import { Scalar, CustomScalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';

/**
 * Custom scalar for Date objects
 */
@Scalar('Date', () => Date)
export class DateScalar implements CustomScalar<string, Date> {
  description = 'Date custom scalar type';

  parseValue(value: unknown): Date {
    if (typeof value === 'number' || typeof value === 'string') {
      return new Date(value);
    }
    throw new Error('Invalid date value');
  }

  serialize(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'number' || typeof value === 'string') {
      return new Date(value).toISOString();
    }
    throw new Error('Invalid date value');
  }

  parseLiteral(ast: ValueNode): Date {
    if (ast.kind === Kind.STRING || ast.kind === Kind.INT) {
      return new Date(ast.value);
    }
    throw new Error('Invalid date literal');
  }
}
