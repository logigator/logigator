import * as z from 'zod';
import { imageVariantSchema } from '../image/image.contract';

/**
 * The field rules shared by registration, profile updates and password resets.
 * The constraints match the legacy form validators', so an existing account
 * still satisfies them.
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
 * too, so a client skipping its own check cannot weaken an account.
 */
export const passwordSchema = z
  .string()
  .min(8)
  .max(200)
  .regex(/[A-Za-z]/, 'must contain a letter')
  .regex(/[0-9]/, 'must contain a digit');

/**
 * The signed-in user, as `GET /user` answers it. The endpoint is authenticated
 * and only ever describes the caller, so it always carries the private fields.
 * A `null` avatar means the account has none. `hasPassword` and `googleLinked`
 * tell an account page which credential controls to offer.
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
 * A partial profile update. Changing the password or the address of an account
 * that has a password requires `currentPassword`: a session alone is not proof
 * of intent for anything that moves control of the account. An address change
 * takes effect only once the mailed verification link is opened.
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
 * Deleting an account requires its password, if it has one. The whole body is
 * optional and an absent one reads as `{}`, because an account with no password
 * has nothing to send and a bare `DELETE` carries no payload.
 */
export const deleteUserRequestSchema = z
  .object({
    password: z.string().min(1).optional()
  })
  .default({});

export type DeleteUserRequest = z.infer<typeof deleteUserRequestSchema>;
