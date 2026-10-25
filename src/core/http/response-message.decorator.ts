import { SetMetadata } from '@nestjs/common';

export const RESPONSE_MESSAGE_KEY = 'http:responseMessage';

/** Override the `message` field of the response envelope for one route. */
export const ResponseMessage = (message: string) =>
  SetMetadata(RESPONSE_MESSAGE_KEY, message);
