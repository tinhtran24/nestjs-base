import { Logger } from '@nestjs/common';
import { MailMessage, MailSender } from './mail-sender';

/** Development transport: prints the email instead of sending it. */
export class ConsoleMailSender extends MailSender {
  private readonly logger = new Logger('Mail');

  async send(message: MailMessage): Promise<void> {
    this.logger.log(
      `to=${message.to} subject="${message.subject}"\n${message.text ?? message.html}`,
    );
  }
}
