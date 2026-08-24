import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type {
  ConfirmPasswordReset,
  LoginRequest,
  RegisterRequest,
  ResendVerificationRequest
} from '@logigator/contract';
import { ApiException } from '../common/api-exception';
import type { Locale } from '../common/locale';
import type { UserRow } from '../database/schema';
import { isUniqueViolation } from '../database/unique-violation';
import { MailService } from '../mail/mail.service';
import { SessionService } from '../session/session.service';
import { UsersService } from '../users/users.service';
import { AuthTokenService } from './auth-token.service';
import { PasswordService } from './password.service';

/**
 * Local (email + password) authentication.
 *
 * Passport is gone. What it contributed here was a strategy registry and a
 * user-serialization hook, and this API needs neither: a guard reads the session
 * and loads the account, and the two credential kinds — password and Google —
 * are two services rather than two plugins.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly tokens: AuthTokenService,
    private readonly mail: MailService,
    private readonly sessions: SessionService
  ) {}

  /**
   * Creates an unverified account and mails it a confirmation link. Login stays
   * refused until that link is opened, which is what keeps an address from being
   * claimed by somebody who does not own it.
   */
  async register(body: RegisterRequest, locale: Locale): Promise<void> {
    const existing = await this.users.findByEmail(body.email);
    if (existing) {
      // Registration cannot hide that an address is taken — it would have to
      // either create a second account for it or pretend to. Saying so plainly
      // is what lets the form offer signing in instead.
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
      // form sends two requests: the loser has to read as the same conflict, not
      // as a server fault.
      if (isUniqueViolation(error)) throw emailTaken();
      throw error;
    }

    await this.sendVerification(user, locale);
  }

  /**
   * Verifies credentials and answers with the account.
   *
   * Every failure mode of a wrong password is one error; only the unverified
   * address is distinguished, because the client has something to offer there.
   */
  async login(body: LoginRequest): Promise<UserRow> {
    const user = await this.authenticate(body.email, body.password);

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
    locale: Locale
  ): Promise<void> {
    const user = await this.authenticate(body.email, body.password);
    if (user.emailVerified) return;

    await this.sendVerification(user, locale);
  }

  /**
   * Activates the address a token stands for.
   *
   * The same token type serves registration and a later change of address, so
   * this is where a new address actually lands on the account.
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
      // The address was free when the mail went out; an hour is long enough for
      // somebody else to have taken it, and the unique constraint is the only
      // place that can be noticed without a lock.
      if (isUniqueViolation(error)) throw emailTaken();
      throw error;
    }

    // The account was deleted while the mail sat in an inbox: there is nothing
    // left for the link to activate, so it reads as a dead one.
    if (!updated) throw invalidToken();
  }

  /**
   * Mails a reset link, if the address belongs to an account that can use one.
   *
   * Answers the same either way: whether an address has an account is not
   * something an unauthenticated caller gets to probe, and this endpoint would
   * otherwise be the easiest place to ask.
   */
  async requestPasswordReset(email: string, locale: Locale): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) return;

    const token = await this.tokens.issuePasswordReset(user.id);
    try {
      await this.mail.sendPasswordReset(
        { email: user.email, username: user.username, locale },
        token
      );
    } catch (error) {
      // Answering 503 here would undo the whole point of the endpoint: an
      // unknown address cannot fail to send, so a failure that reached the
      // caller would say "this address has an account" every time the mail
      // server hiccups. The operator gets the log; the caller gets the same
      // nothing either way, and retrying is already the advice on screen.
      this.logger.error(`Password reset mail to ${user.email} failed`, error);
    }
  }

  /**
   * Sets a new password from a reset token.
   *
   * It also verifies the address: holding a token proves the mailbox was
   * reachable, and an account stuck unverified would otherwise have no way back
   * in. And it ends every session the account had — see below.
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

    // Whoever was signed in on the strength of the old password is signed out by
    // the new one. A reset is what a locked-out or compromised account has, and
    // leaving live sessions behind would mean the intruder keeps their access
    // through the very act meant to end it.
    await this.sessions.signOutEverywhere(user.id);
  }

  /**
   * Checks an email and password pair.
   *
   * An unknown address and an account with no password (a Google-only or
   * migrated Twitter login) both still run a verification, against a hash that
   * matches nothing: the answer has to take the same time in every case, or the
   * response time alone reveals which addresses have accounts.
   */
  private async authenticate(
    email: string,
    password: string
  ): Promise<UserRow> {
    const user = await this.users.findByEmail(email);

    if (!user?.passwordHash) {
      await this.passwords.verifyNothing(password);
      throw invalidCredentials();
    }

    if (!(await this.passwords.verify(password, user.passwordHash))) {
      throw invalidCredentials();
    }

    if (this.passwords.needsRehash(user.passwordHash)) {
      // The password is known to be correct right now, which is the only moment
      // a stored hash can be strengthened. Legacy hashes were made at cost 9.
      // The row it answers with is ignored: the caller is authenticating against
      // the copy it already read, and a vanished account is the guard's business.
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
      // The account exists either way, and the token is valid for an hour, so
      // this is recoverable by asking for the mail again — which is what the
      // client is told.
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
