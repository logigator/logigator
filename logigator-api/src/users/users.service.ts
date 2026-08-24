import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { UserResponse } from '@logigator/contract';
import { DB, type Database } from '../database/database.module';
import { users, type NewUserRow, type UserRow } from '../database/schema';
import { AVATAR_VARIANTS, variantUrls } from '../storage/image-variants';

/**
 * Reads and writes of the `users` table.
 *
 * Addresses are normalized to lower case on the way in and looked up the same
 * way. MySQL's default collation made this moot in the legacy backend;
 * PostgreSQL compares text exactly, so without normalizing here one address
 * could hold two accounts.
 */
@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async findById(id: string): Promise<UserRow | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user ?? null;
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, normalizeEmail(email)))
      .limit(1);
    return user ?? null;
  }

  async findByGoogleUserId(googleUserId: string): Promise<UserRow | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.googleUserId, googleUserId))
      .limit(1);
    return user ?? null;
  }

  async create(values: NewUserRow): Promise<UserRow> {
    const [user] = await this.db
      .insert(users)
      .values({ ...values, email: normalizeEmail(values.email) })
      .returning();
    return user;
  }

  /**
   * Applies a partial change and answers with the stored row, or `null` when
   * there is no such row any more.
   *
   * Nullable rather than assumed: an account can be deleted between the moment a
   * guard loaded it and the moment a handler writes to it, and reading the first
   * element of an empty `returning()` would answer a `TypeError` from deep inside
   * the next thing that touched it.
   */
  async update(
    id: string,
    changes: Partial<Omit<NewUserRow, 'id'>>
  ): Promise<UserRow | null> {
    const [user] = await this.db
      .update(users)
      .set(
        changes.email === undefined
          ? changes
          : { ...changes, email: normalizeEmail(changes.email) }
      )
      .where(eq(users.id, id))
      .returning();
    return user ?? null;
  }

  /**
   * Deletes the account. Everything it owns follows through `ON DELETE CASCADE`,
   * which replaces the legacy `@BeforeRemove` choreography that removed
   * projects, components and the profile picture by hand — and could half-fail.
   */
  async delete(id: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id));
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * The row as clients see it. The avatar is a list of variants: the files behind
 * them are served by the static layer, and their names are nobody else's
 * business. The list comes from the matrix rather than from the volume — the
 * files are written together or not at all, so there is nothing to look up.
 */
export function toUserResponse(user: UserRow): UserResponse {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    emailVerified: user.emailVerified,
    avatar: user.avatarId
      ? variantUrls('profile', user.avatarId, AVATAR_VARIANTS)
      : null,
    memberSince: user.memberSince.toISOString(),
    hasPassword: user.passwordHash !== null,
    googleLinked: user.googleUserId !== null
  };
}
