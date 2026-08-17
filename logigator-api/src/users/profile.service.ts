import { HttpStatus, Injectable } from '@nestjs/common';
import type { UpdateUserRequest } from '@logigator/contract';
import { ApiException } from '../common/api-exception';
import type { Locale } from '../common/locale';
import type { UserRow } from '../database/schema';
import { AuthTokenService } from '../auth/auth-token.service';
import { PasswordService } from '../auth/password.service';
import { MailService } from '../mail/mail.service';
import {
  extensionForImageType,
  FileStorageService
} from '../storage/file-storage.service';
import { UsersService } from './users.service';

/** Whether the update is still waiting on a confirmation mail. */
export interface ProfileUpdateResult {
  user: UserRow;
  emailVerificationSent: boolean;
}

/**
 * What a signed-in user may change about their own account.
 *
 * Every path here already knows who the caller is — the guard resolved the
 * session — so the questions left are about proof of intent: a password change
 * needs the current password, an address change needs the new mailbox to answer,
 * and deleting the account needs the password again.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly tokens: AuthTokenService,
    private readonly mail: MailService,
    private readonly files: FileStorageService
  ) {}

  async update(
    user: UserRow,
    body: UpdateUserRequest,
    locale: Locale
  ): Promise<ProfileUpdateResult> {
    const changes: Partial<Pick<UserRow, 'username' | 'passwordHash'>> = {};

    if (body.username !== undefined) {
      changes.username = body.username;
    }

    if (body.password !== undefined) {
      await this.assertPasswordAllowed(user, body.currentPassword);
      changes.passwordHash = await this.passwords.hash(body.password);
    }

    const emailVerificationSent =
      body.email === undefined
        ? false
        : await this.requestEmailChange(user, body.email, locale);

    const updated =
      Object.keys(changes).length > 0
        ? await this.users.update(user.id, changes)
        : user;

    return { user: updated, emailVerificationSent };
  }

  /**
   * Replaces the avatar and deletes the file it replaces.
   *
   * The order matters: the pointer moves first, so a failed delete leaves an
   * orphan for the sweep rather than a row pointing at nothing.
   */
  async setAvatar(
    user: UserRow,
    content: Buffer,
    mimeType: string
  ): Promise<UserRow> {
    const extension = extensionForImageType(mimeType);
    if (!extension) {
      throw new ApiException(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        'bad_request',
        'An avatar must be a PNG, JPEG or WebP image.'
      );
    }

    const filename = await this.files.write('profile', content, extension);
    const updated = await this.users.update(user.id, { avatarFile: filename });
    if (user.avatarFile) await this.files.remove('profile', user.avatarFile);

    return updated;
  }

  async removeAvatar(user: UserRow): Promise<UserRow> {
    if (!user.avatarFile) return user;

    const updated = await this.users.update(user.id, { avatarFile: null });
    await this.files.remove('profile', user.avatarFile);
    return updated;
  }

  /**
   * Deletes the account and everything it owns.
   *
   * The cascade does the work in one statement, which is the point of modelling
   * ownership as real foreign keys: the legacy version removed projects,
   * components and the picture by hand across several transactions and could
   * leave an account half-deleted.
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
    if (user.avatarFile) await this.files.remove('profile', user.avatarFile);
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
    await this.mail.sendEmailChangeVerification(
      { email, username: user.username, locale },
      token
    );
    return true;
  }

  /**
   * An account that has a password must prove it knows it. One that does not —
   * a Google sign-in, or a migrated Twitter login — is setting a first password,
   * and its session is the proof.
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
