import { z } from 'zod';

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
 * used to be a nested profile-picture resource is one URL — the file behind it is
 * served by the static layer, and its name is an implementation detail.
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
    avatarUrl: z.string().nullable(),
    memberSince: z.string(),
    hasPassword: z.boolean(),
    googleLinked: z.boolean()
  })
  .loose();

export type UserResponse = z.infer<typeof userResponseSchema>;

/**
 * A partial profile update. `currentPassword` is required to change the
 * password of an account that already has one, and changing the address does not
 * take effect until the verification link in the mail is opened.
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

/** Deleting an account requires the password of an account that has one. */
export const deleteUserRequestSchema = z.object({
  password: z.string().min(1).optional()
});

export type DeleteUserRequest = z.infer<typeof deleteUserRequestSchema>;
