import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  discovery,
  randomNonce,
  randomPKCECodeVerifier,
  randomState,
  type Configuration
} from 'openid-client';
import { usernameSchema } from '@logigator/contract';
import { ApiException } from '../common/api-exception';
import { ENV, type Env } from '../config/env';
import type { UserRow } from '../database/schema';
import { isUniqueViolation } from '../database/unique-violation';
import { RedisService } from '../redis/redis.service';
import { isGoogleAuthConfigured } from './google-auth.config';
import { FileStorageService } from '../storage/file-storage.service';
import { extensionForImageType } from '../storage/file-storage.service';
import { UsersService } from '../users/users.service';

const GOOGLE_ISSUER = new URL('https://accounts.google.com');

/** How long a started sign-in may take before its state expires. */
const FLOW_TTL_SECONDS = 10 * 60;

/** What the redirect leaves behind for the callback to find. */
interface PendingFlow {
  verifier: string;
  nonce: string;
  /**
   * Whether this round trip is a sign-in or the linking of a provider to an
   * account that is already signed in. Recorded when the flow starts rather than
   * inferred from the session at the end: the session may have changed in
   * between, and the two outcomes are very different.
   */
  mode: 'login' | 'link';
  /** For `link`, the account that asked — the callback refuses any other. */
  userId?: string;
}

/** Why a sign-in did not complete, for the return URL's `?error=`. */
export type GoogleAuthFailure =
  | 'google_failed'
  | 'google_state_invalid'
  | 'google_email_taken'
  | 'google_already_linked';

export class GoogleAuthError extends Error {
  constructor(readonly failure: GoogleAuthFailure) {
    super(failure);
  }
}

/**
 * Google sign-in, as the authorization-code flow with PKCE.
 *
 * `openid-client` does the protocol work — discovery, the token exchange, and
 * ID-token signature and claim validation. Passport's Google strategy is gone
 * with the rest of it, and what replaces it is two routes and this service.
 *
 * Discovery is lazy and memoized: a deployment must not fail to start because
 * Google is unreachable, and the metadata is stable enough to fetch once per
 * process.
 */
@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private configuration?: Promise<Configuration>;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly redis: RedisService,
    private readonly users: UsersService,
    private readonly files: FileStorageService
  ) {}

  /** Whether the deployment has credentials, and so whether the routes work. */
  get enabled(): boolean {
    return isGoogleAuthConfigured(this.env);
  }

  /**
   * Starts a flow and answers the URL to send the browser to. The verifier and
   * nonce stay server-side, keyed by the `state` that comes back — so a callback
   * that cannot name a flow this server started goes nowhere.
   */
  async createAuthorizationUrl(signedInUserId?: string): Promise<string> {
    const configuration = await this.load();
    const verifier = randomPKCECodeVerifier();
    const state = randomState();
    const nonce = randomNonce();

    await this.redis.setJson(
      flowKey(state),
      {
        verifier,
        nonce,
        mode: signedInUserId ? 'link' : 'login',
        ...(signedInUserId ? { userId: signedInUserId } : {})
      } satisfies PendingFlow,
      FLOW_TTL_SECONDS
    );

    return buildAuthorizationUrl(configuration, {
      redirect_uri: this.env.GOOGLE_CALLBACK_URL,
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: await calculatePKCECodeChallenge(verifier),
      code_challenge_method: 'S256'
    }).href;
  }

  /**
   * Completes a flow: exchanges the code, then either signs the identity in or
   * links it to the account that asked.
   *
   * @returns the account whose session should be started, or `null` when a link
   * succeeded and the caller is already signed in as that account.
   */
  async completeCallback(
    query: Record<string, string>,
    signedInUserId?: string
  ): Promise<UserRow | null> {
    const state = query['state'];
    const flow = state
      ? await this.redis.takeJson<PendingFlow>(flowKey(state))
      : null;
    // One redemption per flow: the state key is read and deleted together, so a
    // replayed callback finds nothing.
    if (!flow || !state) throw new GoogleAuthError('google_state_invalid');

    const claims = await this.exchange(query, flow, state);
    const googleUserId = claims.sub;
    // Beyond `sub`, ID-token claims are an index signature: the standard ones
    // are optional, and Google only sends `email` when the scope asked for it.
    const email = claims['email'];
    if (typeof email !== 'string') throw new GoogleAuthError('google_failed');

    if (flow.mode === 'link') {
      // The account that started the linking must still be the one signed in.
      if (!signedInUserId || signedInUserId !== flow.userId) {
        throw new GoogleAuthError('google_state_invalid');
      }
      await this.link(flow.userId, googleUserId);
      return null;
    }

    return this.findOrCreate(googleUserId, email, claims);
  }

  private async exchange(
    query: Record<string, string>,
    flow: PendingFlow,
    state: string
  ) {
    const configuration = await this.load();
    // Built from the configured callback rather than from request headers: the
    // URL is part of what gets validated, and a spoofed `Host` must not enter it.
    const currentUrl = new URL(this.env.GOOGLE_CALLBACK_URL);
    for (const [key, value] of Object.entries(query)) {
      currentUrl.searchParams.set(key, value);
    }

    try {
      const tokens = await authorizationCodeGrant(configuration, currentUrl, {
        pkceCodeVerifier: flow.verifier,
        expectedState: state,
        expectedNonce: flow.nonce
      });
      const claims = tokens.claims();
      if (!claims) throw new Error('no ID token in the token response');
      return claims;
    } catch (error) {
      // Everything from here is between us and Google: a denied consent, an
      // expired code, a clock skew. The user gets one failure to act on.
      this.logger.warn('Google token exchange failed', error);
      throw new GoogleAuthError('google_failed');
    }
  }

  private async link(userId: string, googleUserId: string): Promise<void> {
    const existing = await this.users.findByGoogleUserId(googleUserId);
    if (existing && existing.id !== userId) {
      throw new GoogleAuthError('google_already_linked');
    }
    if (existing) return;

    try {
      await this.users.update(userId, { googleUserId });
    } catch (error) {
      // Two tabs linking the same identity at once: the loser reads the same as
      // arriving second, which is what it is.
      if (isUniqueViolation(error)) {
        throw new GoogleAuthError('google_already_linked');
      }
      throw error;
    }
  }

  private async findOrCreate(
    googleUserId: string,
    email: string,
    claims: Record<string, unknown>
  ): Promise<UserRow> {
    const linked = await this.users.findByGoogleUserId(googleUserId);
    if (linked) return linked;

    // An address that already has an account is not signed into from here.
    // Google asserts the address, but treating that as proof of ownership of an
    // existing local account would be an account takeover by anyone who can
    // register the same address with Google — the legacy backend refused too,
    // and linking stays an action taken from inside the account.
    if (await this.users.findByEmail(email)) {
      throw new GoogleAuthError('google_email_taken');
    }

    try {
      return await this.users.create({
        email,
        username: usernameFrom(claims['name'], email),
        googleUserId,
        // The provider asserts the address, so there is nothing left to confirm.
        emailVerified: true,
        avatarFile: await this.importAvatar(claims['picture'])
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      // Both reads above passed and the insert still lost: either the same
      // identity signed in twice at once — in which case the account it just
      // created is the one to use — or the address was taken in between, which is
      // the refusal the read would have given.
      const raced = await this.users.findByGoogleUserId(googleUserId);
      if (raced) return raced;
      throw new GoogleAuthError('google_email_taken');
    }
  }

  /**
   * Copies the profile picture onto our own volume, best effort.
   *
   * Hotlinking the Google URL would leak every profile view to them and break
   * when the URL rotates. A failure here costs a default avatar, so it is logged
   * and dropped rather than allowed to fail a sign-in.
   */
  private async importAvatar(picture: unknown): Promise<string | null> {
    if (typeof picture !== 'string' || !picture.startsWith('https://')) {
      return null;
    }

    try {
      const response = await fetch(picture, {
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) return null;

      const extension = extensionForImageType(
        response.headers.get('content-type') ?? ''
      );
      if (!extension) return null;

      const content = await readCapped(response, this.env.UPLOAD_MAX_BYTES);
      if (!content) return null;

      return await this.files.write('profile', content, extension);
    } catch (error) {
      this.logger.warn('Importing the Google profile picture failed', error);
      return null;
    }
  }

  private load(): Promise<Configuration> {
    if (!this.enabled) {
      throw new ApiException(
        HttpStatus.NOT_IMPLEMENTED,
        'internal',
        'Google sign-in is not configured on this server.'
      );
    }

    this.configuration ??= discovery(
      GOOGLE_ISSUER,
      this.env.GOOGLE_CLIENT_ID as string,
      this.env.GOOGLE_CLIENT_SECRET
    ).catch((error: unknown) => {
      // Do not cache a failure: the next attempt should try again rather than
      // keep answering with a transient network problem for the process's life.
      this.configuration = undefined;
      throw error;
    });

    return this.configuration;
  }
}

function flowKey(state: string): string {
  return `oauth:google:${state}`;
}

/**
 * Reads a response body, giving up once it exceeds `maxBytes`.
 *
 * The size has to be decided while reading, not after: the timeout bounds how
 * long a picture URL may take but says nothing about how much it may send, and a
 * `content-length` is a claim, not a promise. Both are checked — the header
 * first, so an honest oversized response costs nothing to refuse.
 */
async function readCapped(
  response: Response,
  maxBytes: number
): Promise<Buffer | null> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!response.body) return null;

  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > maxBytes) return null;
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

/**
 * A username for an account arriving from Google: its display name if that can
 * be one, the address' local part otherwise.
 *
 * Neither is usable as given. A display name is free text — spaces, dots,
 * accents, any length — and the contract says a username is 2 to 20 characters of
 * letters, digits, `_` and `-`. Storing one verbatim puts values in the column
 * that the API's own schema rejects, so everything that later reads a username
 * expecting the contract's shape is reading something impossible. Each candidate
 * is reduced to that shape and checked against the schema itself, and the last
 * resort is a name that needs no cleaning.
 */
export function usernameFrom(name: unknown, email: string): string {
  for (const candidate of [name, email.split('@')[0]]) {
    if (typeof candidate !== 'string') continue;

    const cleaned = candidate
      .replaceAll(/\s+/g, '_')
      .replaceAll(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 20);
    if (usernameSchema.safeParse(cleaned).success) return cleaned;
  }

  return 'user';
}
