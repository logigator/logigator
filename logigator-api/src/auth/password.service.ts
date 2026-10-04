import { Inject, Injectable } from '@nestjs/common';
import { hash, hashSync, verify } from '@node-rs/bcrypt';
import { randomUUID } from 'node:crypto';
import { ENV, type Env } from '../config/env';

/**
 * bcrypt, because the stored hashes have to keep verifying. It encodes its cost
 * in the hash, so raising the cost for new passwords costs nothing, and
 * {@link needsRehash} lets a weaker stored hash catch up on the next sign-in.
 */
@Injectable()
export class PasswordService {
  private dummyHash?: string;

  constructor(@Inject(ENV) private readonly env: Env) {}

  hash(plain: string): Promise<string> {
    return hash(plain, this.env.BCRYPT_COST);
  }

  verify(plain: string, hashed: string): Promise<boolean> {
    return verify(plain, hashed);
  }

  /** Whether `hashed` was made with a weaker cost than the one configured now. */
  needsRehash(hashed: string): boolean {
    const cost = Number.parseInt(hashed.split('$')[2] ?? '', 10);
    return Number.isFinite(cost) && cost < this.env.BCRYPT_COST;
  }

  /**
   * Burns the same time a real verification would, so response times do not
   * tell an attacker which addresses have accounts. The hash is of a random
   * string, at the configured cost so the timing actually matches.
   */
  async verifyNothing(plain: string): Promise<false> {
    this.dummyHash ??= hashSync(randomUUID(), this.env.BCRYPT_COST);
    await verify(plain, this.dummyHash);
    return false;
  }
}
