import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiException } from '../common/api-exception';
import type { UserRow } from '../database/schema';
import { LoginAttemptsService } from './login-attempts.service';
import { PasswordService } from './password.service';

/** What a re-authentication reads from the request asking for it. */
export interface ReauthenticationContext {
  /** The client address, for the wrong-password budgets. */
  ip: string;
  /** See `SessionService.signedInRecently`. */
  signedInRecently: boolean;
}

/**
 * Proof beyond the session for an action that changes how the account is
 * signed into or where its mail goes: the current password where the account
 * has one, at any age of the session, and otherwise a sign-in within the
 * window `SessionService.signedInRecently` names. A stolen session
 * cookie carries neither.
 *
 * Wrong passwords count against the sign-in's budgets for the account on that
 * address, and against one more for the account from every address.
 */
@Injectable()
export class ReauthenticationService {
  constructor(
    private readonly passwords: PasswordService,
    private readonly attempts: LoginAttemptsService
  ) {}

  /**
   * @param refusal the message of the `reauthentication_required` answer,
   * naming the action that needs the fresh sign-in.
   */
  async assertProven(
    user: UserRow,
    password: string | undefined,
    context: ReauthenticationContext,
    refusal: string
  ): Promise<void> {
    if (user.passwordHash) {
      if (!password) throw invalidCredentials();
      if (!(await this.verify(user, user.passwordHash, password, context.ip))) {
        throw invalidCredentials();
      }
      return;
    }

    if (!context.signedInRecently) throw reauthenticationRequired(refusal);
  }

  private async verify(
    user: UserRow,
    passwordHash: string,
    password: string,
    ip: string
  ): Promise<boolean> {
    const account = { email: user.email, signedInAs: user.id };
    await this.attempts.admit(ip, account);

    let correct: boolean;
    try {
      correct = await this.passwords.verify(password, passwordHash);
    } catch (error) {
      await this.attempts.forgive(ip, account);
      throw error;
    }
    if (correct) await this.attempts.forgive(ip, account);
    return correct;
  }
}

function invalidCredentials(): ApiException {
  return new ApiException(
    HttpStatus.UNAUTHORIZED,
    'invalid_credentials',
    'The password is incorrect.'
  );
}

function reauthenticationRequired(message: string): ApiException {
  return new ApiException(
    HttpStatus.FORBIDDEN,
    'reauthentication_required',
    message
  );
}
