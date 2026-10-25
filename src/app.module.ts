import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import {
  AllExceptionsFilter,
  createValidationPipe,
  ResponseInterceptor,
} from './core/http';
import { MailModule } from './core/mail';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { RolesModule } from './modules/roles/roles.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.development.local', '.env'],
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    DatabaseModule,
    MailModule,
    RolesModule,
    UsersModule,
    AuthModule,
    // Feature modules go here.
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
