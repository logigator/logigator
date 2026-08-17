import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ENV, type Env } from '../config/env';
import { RedisService } from '../redis/redis.service';

/** What an address-confirmation token stands for. */
interface EmailVerification {
  userId: string;
  /**
   * The address to activate. Held on the token rather than on the row, so an
   * unconfirmed change never touches the account: a typo expires instead of
   * locking its owner out.
   */
  email: string;
}

interface PasswordReset {
  userId: string;
}

/**
 * The one-shot tokens the mails carry, in Redis.
 *
 * Redis rather than a table because expiry is the whole semantics: a token is a
 * short-lived capability, and a key that deletes itself cannot be left behind by
 * a missing cleanup job. Redeeming one reads and deletes it in a single command,
 * so a link cannot be used twice — including by two requests arriving together.
 */
@Injectable()
export class AuthTokenService {
  private readonly ttlSeconds: number;

  constructor(
    private readonly redis: RedisService,
    @Inject(ENV) env: Env
  ) {
    this.ttlSeconds = env.AUTH_TOKEN_TTL_MINUTES * 60;
  }

  async issueEmailVerification(userId: string, email: string): Promise<string> {
    const token = newToken();
    await this.redis.setJson(
      verificationKey(token),
      { userId, email } satisfies EmailVerification,
      this.ttlSeconds
    );
    return token;
  }

  redeemEmailVerification(token: string): Promise<EmailVerification | null> {
    return this.redis.takeJson<EmailVerification>(verificationKey(token));
  }

  async issuePasswordReset(userId: string): Promise<string> {
    const token = newToken();
    await this.redis.setJson(
      resetKey(token),
      { userId } satisfies PasswordReset,
      this.ttlSeconds
    );
    return token;
  }

  redeemPasswordReset(token: string): Promise<PasswordReset | null> {
    return this.redis.takeJson<PasswordReset>(resetKey(token));
  }
}

/**
 * 32 random bytes, base64url — long enough that guessing is hopeless and safe to
 * put in a URL path or query without escaping.
 */
function newToken(): string {
  return randomBytes(32).toString('base64url');
}

function verificationKey(token: string): string {
  return `verify-mail:${token}`;
}

function resetKey(token: string): string {
  return `reset-password:${token}`;
}
