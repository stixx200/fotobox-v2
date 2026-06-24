import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { GqlArgumentsHost, GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { Response } from 'express';
import { FotoboxError } from '@fotobox/error';

@Catch(FotoboxError)
export class FotoboxExceptionFilter
  implements ExceptionFilter, GqlExceptionFilter
{
  catch(exception: FotoboxError, host: ArgumentsHost): GraphQLError | void {
    if (host.getType<string>() === 'graphql') {
      GqlArgumentsHost.create(host);
      return new GraphQLError(exception.message, {
        extensions: {
          code: exception.code ?? 'MAIN.UNKNOWN',
          info: exception.info,
        },
      });
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: exception.message,
      code: exception.code ?? 'MAIN.UNKNOWN',
      info: exception.info,
    });
  }
}
