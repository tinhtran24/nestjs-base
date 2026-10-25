import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import {
  ForeignKeyConstraintError,
  UniqueConstraintError,
  ValidationError as SequelizeValidationError,
} from 'sequelize';

interface ErrorBody {
  statusCode: number;
  message: string;
  errors?: unknown;
}

/**
 * Turns every thrown error into the same JSON shape. Database errors are mapped
 * to 4xx where it makes sense; anything unknown becomes a generic 500 so that
 * internals (SQL, stack traces) never reach the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const body = this.toBody(exception);

    if (body.statusCode >= 500)
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
      );

    httpAdapter.reply(
      ctx.getResponse(),
      {
        ...body,
        path: httpAdapter.getRequestUrl(ctx.getRequest()),
        timestamp: new Date().toISOString(),
      },
      body.statusCode,
    );
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string')
        return { statusCode, message: response };
      const { message, errors } = response as Record<string, any>;
      return {
        statusCode,
        message: Array.isArray(message) ? message.join(', ') : message,
        ...(errors && { errors }),
      };
    }
    if (exception instanceof UniqueConstraintError)
      return {
        statusCode: HttpStatus.CONFLICT,
        message: 'Resource already exists',
        errors: exception.errors.map((e) => ({
          field: e.path,
          messages: [`${e.path} must be unique`],
        })),
      };
    if (exception instanceof ForeignKeyConstraintError)
      return {
        statusCode: HttpStatus.CONFLICT,
        message: 'Related resource does not exist or is still referenced',
      };
    if (exception instanceof SequelizeValidationError)
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        errors: exception.errors.map((e) => ({
          field: e.path,
          messages: [e.message],
        })),
      };
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }
}
