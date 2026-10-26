import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiException } from '../common/api-exception';
import type { UserRow } from '../database/schema';
import { PasswordService } from './password.service';

/**
 * Proof beyond the session for an action that changes how the account is
 * signed into or where its mail goes: the current password where the account
 * has one, at any age of the session, and otherwise a sign-in within the
 * window `SessionService.signedInRecently` names. A stolen session
 * cookie carries neither.
 */
@Injectable()
export class ReauthenticationService {
  constructor(private readonly passwords: PasswordService) {}

  /**
   * @param refusal the message of the `reauthentication_required` answer,
   * naming the action that needs the fresh sign-in.
   */
  async assertProven(
    user: UserRow,
    password: string | undefined,
    signedInRecently: boolean,
    refusal: string
  ): Promise<void> {
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
      return;
    }

    if (!signedInRecently) throw reauthenticationRequired(refusal);
  }
}

function reauthenticationRequired(message: string): ApiException {
  return new ApiException(
    HttpStatus.FORBIDDEN,
    'reauthentication_required',
    message
  );
}
