import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { Paginated } from './paginated';
import { RESPONSE_MESSAGE_KEY } from './response-message.decorator';

/**
 * Wraps every successful response in one envelope so clients can rely on a
 * single shape: `{ statusCode, message, data, meta? }`.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const message =
      this.reflector.get<string>(RESPONSE_MESSAGE_KEY, context.getHandler()) ??
      'OK';
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((body) => {
        if (body instanceof StreamableFile) return body;
        const statusCode = response.statusCode;
        if (body instanceof Paginated)
          return { statusCode, message, data: body.items, meta: body.meta };
        return { statusCode, message, data: body ?? null };
      }),
    );
  }
}
