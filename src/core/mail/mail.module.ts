import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { ConsoleMailSender } from './console-mail.sender';
import { MailSender } from './mail-sender';
import { SmtpMailSender } from './smtp-mail.sender';

@Global()
@Module({
  providers: [
    {
      provide: MailSender,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): MailSender => {
        const mail = config.get('mail', { infer: true });
        switch (mail.driver) {
          case 'smtp':
            return new SmtpMailSender({ ...mail.smtp, from: mail.from });
          default:
            return new ConsoleMailSender();
        }
      },
    },
  ],
  exports: [MailSender],
})
export class MailModule {}
