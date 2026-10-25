import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { AppConfig } from '../../config/configuration';
import { MailSender } from '../../core/mail';
import { PasswordHasher } from '../../core/security/password-hasher';
import { User } from '../users/models/user.model';
import { RoleType } from '../roles/role-type.enum';
import { UsersService } from '../users/users.service';
import { resetPasswordMail, verifyEmailMail } from './auth.mails';
import {
  ChangePasswordDto,
  LoginDto,
  LoginResponse,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Compared against when the email is unknown, so timing does not reveal it. */
  private readonly dummyHash: Promise<string>;

  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly passwords: PasswordHasher,
    private readonly mail: MailSender,
    private readonly config: ConfigService<AppConfig, true>,
  ) {
    this.dummyHash = this.passwords.hash(randomUUID());
  }

  private get requireVerification(): boolean {
    return this.config.get('auth', { infer: true }).requireEmailVerification;
  }

  private frontendLink(path: string, token: string): string {
    const base = this.config.get('app', { infer: true }).frontendUrl;
    return `${base}${path}?token=${encodeURIComponent(token)}`;
  }

  async register(dto: RegisterDto): Promise<User> {
    if (await this.users.findByEmail(dto.email))
      throw new ConflictException('Email is already registered');

    const user = await this.users.create({
      ...dto,
      isVerified: !this.requireVerification,
      roles: [RoleType.USER],
    });
    if (this.requireVerification) await this.sendVerification(user);
    return user;
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    // Same response whether or not the account exists.
    if (user && !user.isVerified) await this.sendVerification(user);
  }

  async verifyEmail(token: string): Promise<void> {
    const { sub } = await this.tokens.verify(token, 'verify-email');
    await this.users.markVerified(sub);
  }

  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.users.findByEmailWithPassword(dto.email);
    const passwordOk = await this.passwords.verify(
      dto.password,
      user?.password ?? (await this.dummyHash),
    );
    if (!user || !user.password || !passwordOk)
      throw new UnauthorizedException('Invalid email or password');
    if (!user.isActive) throw new ForbiddenException('Account is disabled');
    if (this.requireVerification && !user.isVerified)
      throw new ForbiddenException('Email address is not verified');

    await this.users.touchLastLogin(user.id);
    return {
      accessToken: await this.tokens.sign(user.id, 'access'),
      tokenType: 'Bearer',
      expiresIn: this.tokens.accessTokenTtl,
      user: await this.users.findOne(user.id),
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.users.findByIdWithPassword(userId);
    const ok =
      !!user?.password &&
      (await this.passwords.verify(dto.currentPassword, user.password));
    if (!ok) throw new BadRequestException('Current password is incorrect');
    await this.users.setPassword(userId, dto.newPassword);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmailWithPassword(email);
    // Same response whether or not the account exists.
    if (!user || !user.isActive) return;
    const token = await this.tokens.sign(user.id, 'reset-password', {
      pwd: this.tokens.passwordFingerprint(user.password),
    });
    await this.deliver(
      resetPasswordMail(
        user.email,
        this.frontendLink('/reset-password', token),
      ),
    );
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const payload = await this.tokens.verify(dto.token, 'reset-password');
    const user = await this.users.findByIdWithPassword(payload.sub);
    // Fingerprint mismatch = password already changed with this or a newer token.
    if (!user || payload.pwd !== this.tokens.passwordFingerprint(user.password))
      throw new UnauthorizedException('Invalid or expired token');
    await this.users.setPassword(user.id, dto.password);
  }

  private async sendVerification(user: User): Promise<void> {
    const token = await this.tokens.sign(user.id, 'verify-email');
    await this.deliver(
      verifyEmailMail(user.email, this.frontendLink('/verify-email', token)),
    );
  }

  /** Mail failures are logged, not surfaced: the account action already succeeded. */
  private async deliver(message: Parameters<MailSender['send']>[0]) {
    try {
      await this.mail.send(message);
    } catch (error) {
      this.logger.error(`Failed to send "${message.subject}"`, error?.stack);
    }
  }
}
