import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { AppConfig } from '../../config/configuration';

/**
 * Every token carries its purpose in `typ`, so an email-verification or
 * password-reset token can never be replayed as an access token (and vice versa).
 */
export type TokenPurpose = 'access' | 'verify-email' | 'reset-password';

export interface TokenPayload {
  sub: string;
  typ: TokenPurpose;
  /** Password fingerprint: makes reset tokens single-use. */
  pwd?: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  sign(
    subject: string,
    purpose: TokenPurpose,
    extra: Partial<TokenPayload> = {},
  ): Promise<string> {
    const jwt = this.config.get('jwt', { infer: true });
    const payload: TokenPayload = { ...extra, sub: subject, typ: purpose };
    return this.jwt.signAsync(payload, {
      expiresIn: purpose === 'access' ? jwt.expiresIn : jwt.actionExpiresIn,
    });
  }

  /** Verifies signature, expiry and purpose. Throws 401 on any mismatch. */
  async verify(token: string, purpose: TokenPurpose): Promise<TokenPayload> {
    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(token, {
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (payload.typ !== purpose || !payload.sub)
      throw new UnauthorizedException('Invalid or expired token');
    return payload;
  }

  /** A short digest of the stored hash; changes whenever the password changes. */
  passwordFingerprint(passwordHash: string | null): string {
    return createHash('sha256')
      .update(passwordHash ?? '')
      .digest('base64url')
      .slice(0, 16);
  }

  get accessTokenTtl(): string {
    return this.config.get('jwt', { infer: true }).expiresIn;
  }
}
