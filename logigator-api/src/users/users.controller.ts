import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  deleteUserRequestSchema,
  updateUserRequestSchema,
  type DeleteUserRequest,
  type UpdateUserRequest,
  type UpdateUserResponse,
  type UserResponse
} from '@logigator/contract';
import { ApiException } from '../common/api-exception';
import { localeFromRequest } from '../common/locale';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { UserRow } from '../database/schema';
import { SessionService } from '../session/session.service';
import { ProfileService } from './profile.service';
import { toUserResponse } from './users.service';

/**
 * The signed-in user's own account. Every route requires a session and describes
 * only its caller, so there are no ownership checks to get wrong and no
 * serialization groups to leak past.
 */
@Controller('user')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(
    private readonly profile: ProfileService,
    private readonly session: SessionService
  ) {}

  @Get()
  getCurrentUser(@CurrentUser() user: UserRow): UserResponse {
    return toUserResponse(user);
  }

  @Patch()
  async update(
    @CurrentUser() user: UserRow,
    @Body(new ZodValidationPipe(updateUserRequestSchema))
    body: UpdateUserRequest,
    @Req() request: FastifyRequest
  ): Promise<UpdateUserResponse> {
    const result = await this.profile.update(
      user,
      body,
      localeFromRequest(request),
      // Spared when a password change signs the account's other sessions out.
      request.session.sessionId
    );

    return {
      user: toUserResponse(result.user),
      emailVerificationSent: result.emailVerificationSent
    };
  }

  /**
   * Replaces the avatar. Multipart rather than JSON: the file arrives as bytes,
   * and base64 in a JSON body would inflate it by a third for nothing.
   */
  @Post('avatar')
  async setAvatar(
    @CurrentUser() user: UserRow,
    @Req() request: FastifyRequest
  ): Promise<UserResponse> {
    const upload = await request.file();
    if (!upload) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'bad_request',
        'Expected an uploaded file.'
      );
    }

    const content = await upload.toBuffer();
    // `toBuffer` resolves even when the stream was cut off at the limit, so the
    // flag is the only thing that distinguishes a truncated file from a whole
    // one — storing the truncation would mean a corrupt image.
    if (upload.file.truncated) {
      throw new ApiException(
        HttpStatus.PAYLOAD_TOO_LARGE,
        'bad_request',
        'The image is too large.'
      );
    }

    // The declared part type is not passed on: what the file actually is gets
    // decided by decoding it.
    const updated = await this.profile.setAvatar(user, content);
    return toUserResponse(updated);
  }

  @Delete('avatar')
  async removeAvatar(@CurrentUser() user: UserRow): Promise<UserResponse> {
    return toUserResponse(await this.profile.removeAvatar(user));
  }

  /** Deletes the account, then ends the session it was made from. */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(
    @CurrentUser() user: UserRow,
    @Body(new ZodValidationPipe(deleteUserRequestSchema))
    body: DeleteUserRequest,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply
  ): Promise<void> {
    await this.profile.deleteAccount(user, body.password);
    await this.session.signOut(request, reply);
  }
}
