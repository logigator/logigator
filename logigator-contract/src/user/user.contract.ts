import * as z from 'zod';
import { imageVariantSchema } from '../image/image.contract';

/**
 * The field rules shared by every endpoint that accepts them — registration,
 * profile updates, password resets. They are the legacy form validators'
 * constraints, preserved so accounts that satisfied the old rules keep
 * satisfying the new ones.
 */
export const usernameSchema = z
  .string()
  .trim()
  .min(2)
  .max(20)
  .regex(/^[a-zA-Z0-9_-]+$/, 'may contain letters, digits, `_` and `-` only');

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

/**
 * At least eight characters, with a letter and a digit. Enforced server-side
 * too, so a client that skips its own check cannot weaken an account.
 */
export const passwordSchema = z
  .string()
  .min(8)
  .max(200)
  .regex(/[A-Za-z]/, 'must contain a letter')
  .regex(/[0-9]/, 'must contain a digit');

/**
 * The signed-in user, as `GET /user` answers it.
 *
 * There are no serialization groups any more: the endpoint is authenticated and
 * only ever describes the caller, so it always carries the private fields. What
 * used to be a nested profile-picture resource is a list of variants — the files
 * behind them are served by the static layer, and their names are an
 * implementation detail. `null` means the account has no avatar and the client
 * shows whatever it uses for that.
 *
 * `hasPassword` and `googleLinked` are what an account page needs to decide
 * which credential controls it can offer.
 */
export const userResponseSchema = z
  .object({
    id: z.string().uuid(),
    username: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    avatar: z.array(imageVariantSchema).nullable(),
    memberSince: z.string(),
    hasPassword: z.boolean(),
    googleLinked: z.boolean()
  })
  .loose();

export type UserResponse = z.infer<typeof userResponseSchema>;

/**
 * A partial profile update. `currentPassword` is required to change either the
 * password or the address of an account that has a password — a session is not
 * proof of intent for anything that moves control of the account — and changing
 * the address does not take effect until the verification link in the mail is
 * opened.
 */
export const updateUserRequestSchema = z
  .object({
    username: usernameSchema.optional(),
    email: emailSchema.optional(),
    password: passwordSchema.optional(),
    currentPassword: z.string().min(1).optional()
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'must contain at least one field to update'
  });

export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;

/** What `PATCH /user` answers: the updated user, plus whether a mail was sent. */
export const updateUserResponseSchema = z
  .object({
    user: userResponseSchema,
    /** True when the address change is waiting on the verification link. */
    emailVerificationSent: z.boolean()
  })
  .loose();

export type UpdateUserResponse = z.infer<typeof updateUserResponseSchema>;

/**
 * Deleting an account requires the password of an account that has one.
 *
 * The whole body is optional, and an absent one reads as `{}`: an account with
 * no password has nothing to send, and `fetch(url, { method: 'DELETE' })` — the
 * natural call for it — carries no payload at all.
 */
export const deleteUserRequestSchema = z
  .object({
    password: z.string().min(1).optional()
  })
  .default({});

export type DeleteUserRequest = z.infer<typeof deleteUserRequestSchema>;
