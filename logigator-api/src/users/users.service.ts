import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { UserResponse } from '@logigator/contract';
import { DB, type Database } from '../database/database.module';
import { users, type NewUserRow, type UserRow } from '../database/schema';
import { AVATAR_VARIANTS, variantUrls } from '../storage/image-variants';

/**
 * Reads and writes of the `users` table. Addresses are normalized to lower case
 * on the way in and looked up the same way: PostgreSQL compares text exactly,
 * so without it one address could hold two accounts.
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
   * there is no such row any more — an account can be deleted between the guard
   * loading it and a handler writing to it.
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

  /** Deletes the account; everything it owns follows through the cascade. */
  async delete(id: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id));
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * The row as clients see it. The avatar's variant list comes from the matrix
 * rather than the volume: the files are written together or not at all.
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
