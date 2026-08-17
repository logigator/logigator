import {
  boolean,
  index,
  pgTable,
  timestamp,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';

/**
 * An account. Credentials are all nullable and independent: a user may have a
 * password, a linked Google account, or both, and the Phase 6 migration lands
 * accounts that have neither (Twitter-only logins, whose provider is dropped)
 * so they can recover by email. Nothing is enforced here beyond uniqueness —
 * which credential is usable is a question for the login path, and a constraint
 * would only make those accounts unmigratable.
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
     * Whether the address has been confirmed. Local registration leaves this
     * false until the verification link is opened and blocks login meanwhile;
     * an address that arrives from an OAuth provider is verified by definition.
     */
    emailVerified: boolean('email_verified').notNull().default(false),
    /** bcrypt, and only ever read by a verifier — legacy `$2b$09$` hashes verify unchanged. */
    passwordHash: varchar('password_hash', { length: 72 }),
    googleUserId: varchar('google_user_id', { length: 64 }).unique(),
    /**
     * Filename of the avatar on the served volume, or null for the default
     * avatar. Derived, browser-served binaries stay files; the row holds the
     * pointer only, and the file is replaced by writing a new name here.
     */
    avatarFile: varchar('avatar_file', { length: 64 }),
    memberSince: timestamp('member_since', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [index('users_username_idx').on(t.username)]
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
