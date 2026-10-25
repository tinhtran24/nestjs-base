import { applyDecorators } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';

/** 8–72 chars (bcrypt ignores bytes after 72) with at least one letter and one digit. */
export const IsPassword = () =>
  applyDecorators(
    IsString(),
    Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,72}$/, {
      message:
        'password must be 8-72 characters and contain at least one letter and one number',
    }),
  );
