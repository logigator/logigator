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
import { safeReturnPath } from '@logigator/core';
import { ApiException } from '../common/api-exception';
import { ENV, type Env } from '../config/env';
import type { UserRow } from '../database/schema';
import { isUniqueViolation } from '../database/unique-violation';
import { RedisService } from '../redis/redis.service';
import { isGoogleAuthConfigured } from './google-auth.config';
import { FileStorageService } from '../storage/file-storage.service';
import { ImageService } from '../storage/image.service';
import { UsersService } from '../users/users.service';

const GOOGLE_ISSUER = new URL('https://accounts.google.com');

/** How long a started sign-in may take before its state expires. */
const FLOW_TTL_SECONDS = 10 * 60;

/** What the redirect leaves behind for the callback to find. */
interface PendingFlow {
  verifier: string;
  nonce: string;
  /**
   * Sign-in, or the linking of a provider to an account already signed in.
   * Recorded when the flow starts rather than inferred from the session at the
   * end, which may have changed in between.
   */
  mode: 'login' | 'link';
  /** For `link`, the account that asked — the callback refuses any other. */
  userId?: string;
  /**
   * Where to send the browser once the round trip ends, as a path on the public
   * origin. Kept with the flow rather than passed through Google, so the value
   * the callback redirects to is the one this server accepted at the start.
   */
  returnPath?: string;
}

/** Why a sign-in did not complete, for the return URL's `?error=`. */
export type GoogleAuthFailure =
  | 'google_failed'
  | 'google_state_invalid'
  | 'google_email_taken'
  | 'google_already_linked';

export class GoogleAuthError extends Error {
  constructor(
    readonly failure: GoogleAuthFailure,
    /** The flow's return path, so a failure lands where a retry can continue. */
    readonly returnPath?: string
  ) {
    super(failure);
  }
}

/** What a completed round trip leaves the controller to act on. */
export interface GoogleCallbackResult {
  /**
   * The account whose session should be started, or `null` when a link
   * succeeded and the caller is already signed in as that account.
   */
  user: UserRow | null;
  /** Where the browser asked to be sent, if it named a place. */
  returnPath?: string;
}

/**
 * Google sign-in as the authorization-code flow with PKCE; `openid-client` does
 * the protocol work, including ID-token signature and claim validation.
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
    private readonly files: FileStorageService,
    private readonly images: ImageService
  ) {}

  /** Whether the deployment has credentials, and so whether the routes work. */
  get enabled(): boolean {
    return isGoogleAuthConfigured(this.env);
  }

  /**
   * Starts a flow and answers the URL to send the browser to. The verifier and
   * nonce stay server-side, keyed by the `state` that comes back, so a callback
   * that cannot name a flow this server started goes nowhere.
   */
  async createAuthorizationUrl(
    signedInUserId?: string,
    returnPath?: string | null
  ): Promise<string> {
    const configuration = await this.load();
    const verifier = randomPKCECodeVerifier();
    const state = randomState();
    const nonce = randomNonce();
    // Checked here rather than trusted from the caller: this is the value the
    // callback redirects to, and it never leaves this server in between.
    const destination = safeReturnPath(returnPath);

    await this.redis.setJson(
      flowKey(state),
      {
        verifier,
        nonce,
        mode: signedInUserId ? 'link' : 'login',
        ...(signedInUserId ? { userId: signedInUserId } : {}),
        ...(destination ? { returnPath: destination } : {})
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
   */
  async completeCallback(
    query: Record<string, string>,
    signedInUserId?: string
  ): Promise<GoogleCallbackResult> {
    const state = query['state'];
    const flow = state
      ? await this.redis.takeJson<PendingFlow>(flowKey(state))
      : null;
    // One redemption per flow: the state key is read and deleted together, so a
    // replayed callback finds nothing.
    if (!flow || !state) throw new GoogleAuthError('google_state_invalid');

    try {
      return {
        user: await this.identify(query, flow, state, signedInUserId),
        returnPath: flow.returnPath
      };
    } catch (error) {
      // Every failure from here on belongs to a flow that may have named a
      // destination, and the page it lands on is where the retry happens — so
      // the destination survives the failure rather than only the success.
      if (error instanceof GoogleAuthError) {
        throw new GoogleAuthError(error.failure, flow.returnPath);
      }
      throw error;
    }
  }

  /** The account behind a callback, or `null` when it completed a link. */
  private async identify(
    query: Record<string, string>,
    flow: PendingFlow,
    state: string,
    signedInUserId?: string
  ): Promise<UserRow | null> {
    const claims = await this.exchange(query, flow, state);
    const googleUserId = claims.sub;
    // Beyond `sub`, ID-token claims are an index signature: the standard ones
    // are optional, and Google only sends `email` when the scope asked for it.
    const email = claims['email'];
    if (typeof email !== 'string') throw new GoogleAuthError('google_failed');

    if (flow.mode === 'link') {
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
      // A denied consent, an expired code, a clock skew: everything here is
      // between us and Google, and the user gets one failure to act on.
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
      // Two tabs linking the same identity at once; the loser arrived second.
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

    // Google asserting an address is not proof of owning an existing local
    // account: treating it as one is an account takeover by anyone who can
    // register the same address with Google. Linking stays an action taken from
    // inside the account.
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
        avatarId: await this.importAvatar(claims['picture'])
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      // Both reads above passed and the insert still lost: either the same
      // identity signed in twice at once, in which case the account it just
      // created is the one to use, or the address was taken in between.
      const raced = await this.users.findByGoogleUserId(googleUserId);
      if (raced) return raced;
      throw new GoogleAuthError('google_email_taken');
    }
  }

  /**
   * Copies the profile picture onto our own volume, best effort. Hotlinking the
   * Google URL would leak every profile view to them and break when the URL
   * rotates; a failure here costs a default avatar, so it is logged and dropped
   * rather than allowed to fail a sign-in.
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

      const content = await readCapped(response, this.env.UPLOAD_MAX_BYTES);
      if (!content) return null;

      // Through the same encoder as an upload, so what the provider sends is
      // proof of nothing and the served variants are identical either way.
      const files = await this.images.encodeAvatar(content);
      return await this.files.writeAsset('profile', files);
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
      // Do not cache a failure: a transient network problem must not answer for
      // the life of the process.
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
 * Reads a response body, giving up once it exceeds `maxBytes`. The size has to
 * be decided while reading: the timeout bounds how long a URL may take but not
 * how much it may send, and a `content-length` is a claim, not a promise. The
 * header is checked first, so an honest oversized response costs nothing.
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
 * Neither is usable as given — a display name is free text, and the contract
 * says 2 to 20 characters of letters, digits, `_` and `-`. Storing one verbatim
 * would put values in the column that the API's own schema rejects, so each
 * candidate is reduced to that shape and checked against the schema itself. The
 * last resort is a name that needs no cleaning.
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
