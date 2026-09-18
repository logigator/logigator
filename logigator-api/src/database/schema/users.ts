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
    memberSince: timestamp('member_since', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [index('users_username_idx').on(t.username)]
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
