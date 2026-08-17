import { z } from 'zod';
import {
  emailSchema,
  passwordSchema,
  userResponseSchema,
  usernameSchema
} from '../user/user.contract';

/**
 * The auth surface is JSON, under `/api/auth`. None of the legacy form-post,
 * session-flash and redirect machinery survives: the landing app owns the forms
 * and reads these responses, and the editor only ever needs the session cookie
 * they set.
 */

export const registerRequestSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

/**
 * Registration answers what has to happen next rather than a user: the account
 * exists but cannot sign in until the address is confirmed.
 */
export const registerResponseSchema = z
  .object({
    verificationRequired: z.literal(true)
  })
  .loose();

export type RegisterResponse = z.infer<typeof registerResponseSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  // Not `passwordSchema`: an existing password only has to match, and applying
  // today's rules here would lock out an account that predates them.
  password: z.string().min(1)
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** Login answers with the signed-in user; the session travels in the cookie. */
export const loginResponseSchema = userResponseSchema;

export type LoginResponse = z.infer<typeof loginResponseSchema>;

/** Resending the verification mail needs the credentials, so it cannot be used to spam an address. */
export const resendVerificationRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1)
});

export type ResendVerificationRequest = z.infer<
  typeof resendVerificationRequestSchema
>;

export const verifyEmailRequestSchema = z.object({
  token: z.string().min(1)
});

export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;

export const requestPasswordResetSchema = z.object({
  email: emailSchema
});

export type RequestPasswordReset = z.infer<typeof requestPasswordResetSchema>;

export const confirmPasswordResetSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema
});

export type ConfirmPasswordReset = z.infer<typeof confirmPasswordResetSchema>;
