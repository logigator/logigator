import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { UpdateUserRequest } from '@logigator/contract';
import { ApiException } from '../common/api-exception';
import type { Locale } from '../common/locale';
import type { UserRow } from '../database/schema';
import { AuthTokenService } from '../auth/auth-token.service';
import { PasswordService } from '../auth/password.service';
import { MailService } from '../mail/mail.service';
import { SessionService } from '../session/session.service';
import { FileStorageService } from '../storage/file-storage.service';
import { ImageService } from '../storage/image.service';
import { UsersService } from './users.service';

/** Whether the update is still waiting on a confirmation mail. */
export interface ProfileUpdateResult {
  user: UserRow;
  emailVerificationSent: boolean;
}

/**
 * What a signed-in user may change about their own account.
 *
 * A session alone is not proof of intent for anything that moves control of the
 * account: the password, the address and deletion all need the current
 * password. Leaving the address off that list turns a stolen session cookie
 * into a takeover — change the address, confirm from the new mailbox, then
 * reset the password, none of it gated by anything the owner knows.
 */
@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly tokens: AuthTokenService,
    private readonly mail: MailService,
    private readonly files: FileStorageService,
    private readonly images: ImageService,
    private readonly sessions: SessionService
  ) {}

  /**
   * @param currentSessionId the session making the request, which a password
   * change spares when it signs the account's other sessions out.
   */
  async update(
    user: UserRow,
    body: UpdateUserRequest,
    locale: Locale,
    currentSessionId?: string
  ): Promise<ProfileUpdateResult> {
    const changes: Partial<Pick<UserRow, 'username' | 'passwordHash'>> = {};

    // Once for both: bcrypt is deliberately expensive, and a combined change
    // would otherwise verify the same password twice.
    if (body.password !== undefined || body.email !== undefined) {
      await this.assertPasswordAllowed(user, body.currentPassword);
    }

    if (body.username !== undefined) {
      changes.username = body.username;
    }

    if (body.password !== undefined) {
      changes.passwordHash = await this.passwords.hash(body.password);
    }

    const emailVerificationSent =
      body.email === undefined
        ? false
        : await this.requestEmailChange(user, body.email, locale);

    const updated =
      Object.keys(changes).length > 0
        ? ((await this.users.update(user.id, changes)) ?? accountGone())
        : user;

    if (body.password !== undefined) {
      // The password that let the other sessions in is gone, so they go with
      // it. This one stays: the identity did not change.
      await this.sessions.signOutEverywhere(user.id, currentSessionId);
    }

    return { user: updated, emailVerificationSent };
  }

  /**
   * Replaces the avatar and deletes the asset it replaces. Two orderings
   * matter: the encode runs before anything is written, so an unusable upload
   * changes nothing and answers a 415; and the pointer moves before the old
   * asset is deleted, so a failed delete leaves an orphan for the sweep rather
   * than a row pointing at nothing.
   */
  async setAvatar(user: UserRow, content: Buffer): Promise<UserRow> {
    const files = await this.images.encodeAvatar(content);

    const avatarId = await this.files.writeAsset('profile', files);
    const updated =
      (await this.users.update(user.id, { avatarId })) ?? accountGone();
    if (user.avatarId) await this.files.removeAsset('profile', user.avatarId);

    return updated;
  }

  async removeAvatar(user: UserRow): Promise<UserRow> {
    if (!user.avatarId) return user;

    const updated =
      (await this.users.update(user.id, { avatarId: null })) ?? accountGone();
    await this.files.removeAsset('profile', user.avatarId);
    return updated;
  }

  /**
   * Deletes the account and everything it owns. The cascade does the work in
   * one statement, so an account cannot be left half-deleted.
   */
  async deleteAccount(user: UserRow, password?: string): Promise<void> {
    if (user.passwordHash) {
      if (
        !password ||
        !(await this.passwords.verify(password, user.passwordHash))
      ) {
        throw new ApiException(
          HttpStatus.UNAUTHORIZED,
          'invalid_credentials',
          'The password is incorrect.'
        );
      }
    }

    await this.users.delete(user.id);
    if (user.avatarId) await this.files.removeAsset('profile', user.avatarId);
  }

  /**
   * Mails a confirmation to the proposed address. The account keeps its current
   * one until that link is opened — a typo has to be recoverable.
   */
  private async requestEmailChange(
    user: UserRow,
    email: string,
    locale: Locale
  ): Promise<boolean> {
    if (email === user.email) return false;

    if (await this.users.findByEmail(email)) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'conflict',
        'That email address already has an account.'
      );
    }

    const token = await this.tokens.issueEmailVerification(user.id, email);
    try {
      await this.mail.sendEmailChangeVerification(
        { email, username: user.username, locale },
        token
      );
    } catch (error) {
      // Nothing has moved yet — the address lives on the token — so the caller
      // is told rather than left believing a mail is on its way.
      this.logger.error(`Email change mail to ${email} failed`, error);
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'service_unavailable',
        'The confirmation email could not be sent. Please try again.'
      );
    }
    return true;
  }

  /**
   * An account that has a password must prove it knows it, for a change of
   * password or of address alike. One that does not — a Google sign-in — has
   * nothing to prove with, and its session is the only proof available.
   */
  private async assertPasswordAllowed(
    user: UserRow,
    currentPassword: string | undefined
  ): Promise<void> {
    if (!user.passwordHash) return;

    if (
      !currentPassword ||
      !(await this.passwords.verify(currentPassword, user.passwordHash))
    ) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'invalid_credentials',
        'The current password is incorrect.'
      );
    }
  }
}

/**
 * The account was loaded moments ago, so its disappearing means it was deleted
 * mid-request. There is no caller left to serve, which is what 401 says.
 */
function accountGone(): never {
  throw new ApiException(
    HttpStatus.UNAUTHORIZED,
    'unauthorized',
    'This account no longer exists.'
  );
}
