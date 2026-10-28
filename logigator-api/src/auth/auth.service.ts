import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type {
  ConfirmPasswordReset,
  LoginRequest,
  RegisterRequest,
  ResendVerificationRequest
} from '@logigator/contract';
import { ApiException } from '../common/api-exception';
import type { Locale } from '../common/locale';
import { spendBudgets } from '../common/rate-limit';
import type { UserRow } from '../database/schema';
import { isUniqueViolation } from '../database/unique-violation';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
import { SessionService } from '../session/session.service';
import { UsersService } from '../users/users.service';
import { AuthTokenService } from './auth-token.service';
import { accountKey, LoginAttemptsService } from './login-attempts.service';
import { PasswordService } from './password.service';

/** Reset mails one mailbox may be sent per window, whoever asks. */
const RESETS_PER_RECIPIENT = 5;
const RESET_WINDOW_SECONDS = 3600;

/** Local (email + password) authentication. */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly tokens: AuthTokenService,
    private readonly mail: MailService,
    private readonly sessions: SessionService,
    private readonly attempts: LoginAttemptsService,
    private readonly redis: RedisService
  ) {}

  /**
   * Creates an unverified account and mails it a confirmation link. Login stays
   * refused until that link is opened, which keeps an address from being
   * claimed by somebody who does not own it.
   */
  async register(body: RegisterRequest, locale: Locale): Promise<void> {
    const existing = await this.users.findByEmail(body.email);
    if (existing) {
      // Registration cannot hide that an address is taken, and saying so
      // plainly is what lets the form offer signing in instead.
      throw emailTaken();
    }

    let user: UserRow;
    try {
      user = await this.users.create({
        username: body.username,
        email: body.email,
        passwordHash: await this.passwords.hash(body.password),
        emailVerified: false
      });
    } catch (error) {
      // The read above and this insert are two statements, and a double-clicked
      // form sends two requests: the loser reads as the same conflict.
      if (isUniqueViolation(error)) throw emailTaken();
      throw error;
    }

    await this.sendVerification(user, locale);
  }

  /**
   * Verifies credentials and answers with the account. Every failure mode of a
   * wrong password is one error; only the unverified address is distinguished,
   * because the client has something to offer there.
   */
  async login(body: LoginRequest, ip: string): Promise<UserRow> {
    const user = await this.authenticate(body.email, body.password, ip);

    if (!user.emailVerified) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'email_not_verified',
        'Please confirm your email address before signing in.'
      );
    }

    return user;
  }

  /** Sends the confirmation mail again, for an account that never opened it. */
  async resendVerification(
    body: ResendVerificationRequest,
    ip: string,
    locale: Locale
  ): Promise<void> {
    const user = await this.authenticate(body.email, body.password, ip);
    if (user.emailVerified) return;

    await this.sendVerification(user, locale);
  }

  /**
   * Activates the address a token stands for. The same token type serves
   * registration and a later change of address, so this is where a new address
   * lands on the account.
   */
  async verifyEmail(token: string): Promise<void> {
    const verification = await this.tokens.redeemEmailVerification(token);
    if (!verification) throw invalidToken();

    const user = await this.users.findById(verification.userId);
    if (!user) throw invalidToken();

    let updated;
    try {
      updated = await this.users.update(user.id, {
        email: verification.email,
        emailVerified: true
      });
    } catch (error) {
      // The address was free when the mail went out; the unique constraint is
      // the only place a race for it can be noticed without a lock.
      if (isUniqueViolation(error)) throw emailTaken();
      throw error;
    }

    // The account was deleted while the mail sat in an inbox, so the link reads
    // as a dead one.
    if (!updated) throw invalidToken();
  }

  /**
   * Mails a reset link, if the address belongs to an account that can use one.
   * Answers the same either way: whether an address has an account is not
   * something an unauthenticated caller gets to probe.
   *
   * Each mailbox has its own budget, counted before the lookup so an unknown
   * address runs out the same way. Somebody spending it to block a reset has
   * sent the owner working links already.
   */
  async requestPasswordReset(email: string, locale: Locale): Promise<void> {
    await spendBudgets(
      this.redis,
      [
        {
          key: `rate:password-reset:recipient:${accountKey(email)}`,
          limit: RESETS_PER_RECIPIENT
        }
      ],
      RESET_WINDOW_SECONDS
    );

    const user = await this.users.findByEmail(email);
    if (!user) return;

    const token = await this.tokens.issuePasswordReset(user.id);
    try {
      await this.mail.sendPasswordReset(
        { email: user.email, username: user.username, locale },
        token
      );
    } catch (error) {
      // Answering 503 would undo the point of the endpoint: an unknown address
      // cannot fail to send, so a failure that reached the caller would say
      // "this address has an account" every time the mail server hiccups.
      this.logger.error(`Password reset mail to ${user.email} failed`, error);
    }
  }

  /**
   * Sets a new password from a reset token. It also verifies the address:
   * holding a token proves the mailbox was reachable, and an account stuck
   * unverified would otherwise have no way back in.
   */
  async confirmPasswordReset(body: ConfirmPasswordReset): Promise<void> {
    const reset = await this.tokens.redeemPasswordReset(body.token);
    if (!reset) throw invalidToken();

    const user = await this.users.findById(reset.userId);
    if (!user) throw invalidToken();

    const updated = await this.users.update(user.id, {
      passwordHash: await this.passwords.hash(body.password),
      emailVerified: true
    });
    if (!updated) throw invalidToken();

    // A reset is what a locked-out or compromised account has; leaving live
    // sessions behind would let an intruder keep the access it is meant to end.
    await this.sessions.signOutEverywhere(user.id);
  }

  /**
   * Checks an email and password pair, within the client address' budget of
   * wrong passwords.
   */
  private async authenticate(
    email: string,
    password: string,
    ip: string
  ): Promise<UserRow> {
    await this.attempts.admit(ip, { email });

    let user: UserRow | null;
    try {
      user = await this.matchPassword(email, password);
    } catch (error) {
      await this.attempts.forgive(ip, { email });
      throw error;
    }
    if (!user) throw invalidCredentials();

    await this.attempts.forgive(ip, { email });
    return user;
  }

  /**
   * Answers the account an email and password pair belongs to, or null.
   *
   * An unknown address and an account with no password (a Google-only login)
   * both still run a verification against a hash that matches nothing: the
   * answer has to take the same time in every case, or the response time alone
   * reveals which addresses have accounts.
   */
  private async matchPassword(
    email: string,
    password: string
  ): Promise<UserRow | null> {
    const user = await this.users.findByEmail(email);

    if (!user?.passwordHash) {
      await this.passwords.verifyNothing(password);
      return null;
    }

    if (!(await this.passwords.verify(password, user.passwordHash))) {
      return null;
    }

    if (this.passwords.needsRehash(user.passwordHash)) {
      // The password is known correct right now, which is the only moment a
      // stored hash can be strengthened. The row it answers with is ignored:
      // the caller authenticates against the copy it already read.
      await this.users.update(user.id, {
        passwordHash: await this.passwords.hash(password)
      });
    }

    return user;
  }

  private async sendVerification(user: UserRow, locale: Locale): Promise<void> {
    const token = await this.tokens.issueEmailVerification(user.id, user.email);
    try {
      await this.mail.sendRegistrationVerification(
        { email: user.email, username: user.username, locale },
        token
      );
    } catch (error) {
      // The account exists either way and the token is valid for an hour, so
      // this is recoverable by asking for the mail again.
      this.logger.error(`Verification mail to ${user.email} failed`, error);
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'service_unavailable',
        'The verification email could not be sent. Please try again.'
      );
    }
  }
}

function emailTaken(): ApiException {
  return new ApiException(
    HttpStatus.CONFLICT,
    'conflict',
    'That email address already has an account.'
  );
}

function invalidCredentials(): ApiException {
  return new ApiException(
    HttpStatus.UNAUTHORIZED,
    'invalid_credentials',
    'Email or password is incorrect.'
  );
}

function invalidToken(): ApiException {
  return new ApiException(
    HttpStatus.BAD_REQUEST,
    'token_invalid',
    'This link is no longer valid. Please request a new one.'
  );
}
