import * as z from 'zod';
import { normalizeAuthoredText } from '@logigator/core';
import { imageVariantSchema } from '../image/image.contract';
import {
  MAX_SOCIAL_LINKS,
  socialLinkSchema,
  socialUrlSchema
} from '../social/social.contract';

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

/** Mirrors the column behind it, so a write fails here rather than there. */
const MAX_BIO_LENGTH = 1024;

/**
 * A member's own words about themselves, normalized and capped at the column's
 * length.
 *
 * Rendered as **markdown**, in the restricted form `@logigator/ui` renders
 * every authored field in: the tag set is closed to what markdown syntax
 * produces, raw HTML comes out as text, and a link carries `nofollow ugc`. So
 * a bio may carry emphasis and a link, and still cannot write markup onto a
 * page that carries somebody else's name.
 *
 * What this schema owns is the other half — the characters. `normalizeAuthoredText`
 * removes what no renderer can defend against, the invisibles that make stored
 * text and drawn text disagree. The length is then checked against the
 * normalized form, the way {@link socialUrlSchema} checks the normalized URL:
 * composing can lengthen a string, and it is the result the column has to hold.
 *
 * The plain `.trim()` stays in front of the cap so the set of accepted values
 * does not narrow — a bio pasted at the limit with a trailing newline was
 * always accepted — and so an oversized paste is refused before anything walks
 * it character by character.
 */
export const bioSchema = z
  .string()
  .trim()
  .max(MAX_BIO_LENGTH)
  .transform((raw, ctx) => {
    const bio = normalizeAuthoredText(raw);
    if (bio.length > MAX_BIO_LENGTH) {
      ctx.addIssue({
        code: 'too_big',
        origin: 'string',
        maximum: MAX_BIO_LENGTH,
        inclusive: true,
        message: `must be at most ${MAX_BIO_LENGTH} characters`
      });
      return z.NEVER;
    }
    return bio;
  });

/**
 * The one link shown beside the name, normalized like every other profile link
 * and separate from `socialLinks`: it is a member's own site rather than a
 * presence on somebody else's, and the profile page gives it its own line.
 *
 * Nullable rather than optional-and-defaulted: removing a website is an edit
 * like any other, so a client clearing the field sends `null` and the column
 * goes back to meaning "no website" instead of holding an empty string.
 */
export const websiteUrlSchema = socialUrlSchema.nullable();

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
    bio: z.string(),
    websiteUrl: z.string().nullable(),
    /**
     * The links, each with the platform its host classified as. Classified on
     * read rather than stored, so the account form redraws the plain URLs and a
     * reader is told what each one is.
     */
    socialLinks: z.array(socialLinkSchema),
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
    currentPassword: z.string().min(1).optional(),
    bio: bioSchema.optional(),
    websiteUrl: websiteUrlSchema.optional(),
    /**
     * The whole list, replaced rather than patched: the three slots are ordered
     * and the form edits all of them, so a diff would only invent a way for a
     * client's idea of the order to disagree with the stored one.
     *
     * Duplicates are allowed on purpose. The same URL in two slots is a member
     * saying the same thing twice, and refusing it would be a rule nobody asked
     * for — an exact-duplicate set round-trips untouched.
     */
    socialLinks: z
      .array(socialUrlSchema)
      .max(MAX_SOCIAL_LINKS, `may hold at most ${MAX_SOCIAL_LINKS} links`)
      .optional()
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
