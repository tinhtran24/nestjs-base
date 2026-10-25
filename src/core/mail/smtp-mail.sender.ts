import { createTransport, Transporter } from 'nodemailer';
import { MailMessage, MailSender } from './mail-sender';

export interface SmtpOptions {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
}

export class SmtpMailSender extends MailSender {
  private readonly transporter: Transporter;

  constructor(private readonly options: SmtpOptions) {
    super();
    this.transporter = createTransport({
      host: options.host,
      port: options.port,
      secure: options.port === 465,
      auth: options.user
        ? { user: options.user, pass: options.password }
        : undefined,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.options.from, ...message });
  }
}
