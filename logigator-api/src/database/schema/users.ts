import {
  boolean,
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';

/**
 * An account. Credentials are all nullable and independent: a user may have a
 * password, a linked Google account, both, or neither — an account with neither
 * recovers by email. Which credential is usable is a question for the login
 * path, and a constraint here would only make such accounts unstorable.
 *
 * `email` is the identity users log in with and is unique; `username` is a
 * display name and deliberately is not.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    username: varchar('username', { length: 32 }).notNull(),
    email: varchar('email', { length: 254 }).notNull().unique(),
    /**
     * Local registration leaves this false until the verification link is
     * opened and blocks login meanwhile; an address arriving from an OAuth
     * provider is verified by definition.
     */
    emailVerified: boolean('email_verified').notNull().default(false),
    /** bcrypt; hashes at any cost verify unchanged, whatever theirs was. */
    passwordHash: varchar('password_hash', { length: 72 }),
    googleUserId: varchar('google_user_id', { length: 64 }).unique(),
    /**
     * Id of the avatar's directory on the served volume, or null for the
     * default avatar. Replacing the avatar writes a new id here, which is what
     * keeps the URLs behind it cacheable forever.
     */
    avatarId: uuid('avatar_id'),
    /**
     * What the member says about themselves. **Markdown**, stored as the
     * source a member wrote and parsed nowhere on this side: what it renders
     * to is the reader's app deciding, under `@logigator/ui`'s user-content
     * rule, and what may be in it at all is the contract's `bioSchema`. So
     * this column is still the one place the text lives, and improving the
     * renderer improves every row already in it.
     * `documents.description` is the same column shape for the same reason.
     */
    bio: varchar('bio', { length: 1024 }).notNull().default(''),
    /**
     * The member's own site, kept apart from `socialLinks` because the profile
     * page treats it differently — its own line, more prominent than the row of
     * icons. Nullable rather than defaulted to empty: "no website" is a state
     * the page has to be able to tell from "an empty one".
     */
    websiteUrl: varchar('website_url', { length: 2048 }),
    /**
     * Up to three profile links, in the member's order, stored as the URLs they
     * submitted and nothing else.
     *
     * **The platform is deliberately not stored.** It is derived from the host
     * on every read, so extending the table in `@logigator/core` reclassifies
     * every profile that exists without a migration — and a classification
     * written down once would be one the server could not verify, since no host
     * is ever fetched. `documents.document` is a jsonb column of a different
     * kind: what it holds is expensive to derive and integrity-bearing, which
     * this is not.
     *
     * A child table was the other candidate. It would need an order column and
     * a join per read for a list that is three long and never searched, sorted
     * or filtered.
     */
    socialLinks: jsonb('social_links').$type<string[]>().notNull().default([]),
    memberSince: timestamp('member_since', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [index('users_username_idx').on(t.username)]
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
