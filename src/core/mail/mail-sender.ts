export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Strategy interface for delivering email. Inject `MailSender` and let
 * MailModule pick the concrete transport from MAIL_DRIVER.
 * An abstract class (not an interface) so it can double as the DI token.
 */
export abstract class MailSender {
  abstract send(message: MailMessage): Promise<void>;
}
