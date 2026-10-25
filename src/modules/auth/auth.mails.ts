import { MailMessage } from '../../core/mail';

const layout = (title: string, body: string, link: string, cta: string) => ({
  html: `<h2>${title}</h2><p>${body}</p><p><a href="${link}">${cta}</a></p>
<p>If the button does not work, open this link: ${link}</p>`,
  text: `${title}\n\n${body}\n\n${cta}: ${link}`,
});

export const verifyEmailMail = (to: string, link: string): MailMessage => ({
  to,
  subject: 'Verify your email address',
  ...layout(
    'Welcome!',
    'Please confirm your email address to activate your account.',
    link,
    'Verify email',
  ),
});

export const resetPasswordMail = (to: string, link: string): MailMessage => ({
  to,
  subject: 'Reset your password',
  ...layout(
    'Password reset',
    'Someone asked to reset the password of this account. If it was not you, ignore this email.',
    link,
    'Choose a new password',
  ),
});
