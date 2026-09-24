import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { starTally } from '../community/star-queries';
import { ENV, type Env } from '../config/env';
import { DB, type Database } from '../database/database.module';
import {
  componentStars,
  projectStars,
  users,
  type ComponentRow
} from '../database/schema';
import { FileStorageService } from '../storage/file-storage.service';
import {
  AVATAR_VARIANTS,
  PREVIEW_VARIANTS,
  variantFile
} from '../storage/image-variants';
import { CARD_LAYOUT_VERSION } from '../storage/share-card/card-layout';
import {
  composeShareCard,
  type ShareCardInput
} from '../storage/share-card/share-card';
import {
  ShareService,
  type ShareKind,
  type ShareTarget
} from './share.service';

/** One composed card and the version of its inputs it was composed from. */
interface ComposedCard {
  readonly etag: string;
  readonly png: Buffer;
}

/**
 * A composed card, with the one thing about it this request decided: whether
 * anybody holding the link may fetch it, which is what the route's
 * `Cache-Control` has to say.
 *
 * Not part of {@link ComposedCard}, and so not part of what is cached: the
 * picture never depends on the caller, but *whether there is one at all* does
 * — a private document's card composes for its owner alone. Marking that answer
 * `public` would invite a shared cache to hand it to whoever the route itself
 * answers `404` for.
 */
export interface ShareCard extends ComposedCard {
  readonly publiclyReadable: boolean;
}

/**
 * The rung a card is built from. The dark render because the card is dark, at
 * the size it was stored so the trim sees every pixel there is; the avatar's
 * **WebP** because its JPEG fallback was flattened onto white, which would
 * composite a white square onto the card.
 */
const RENDER_FILE = variantFile(PREVIEW_VARIANTS, {
  slot: 'dark',
  width: 1024,
  format: 'png'
});
const AVATAR_FILE = variantFile(AVATAR_VARIANTS, {
  slot: null,
  width: 64,
  format: 'webp'
});

/**
 * How long a card may be reused without asking. Short, because it denormalizes
 * three rows that move on clocks of their own — and every consumer that matters
 * re-fetches on its own schedule anyway.
 */
export const CARD_MAX_AGE_SECONDS = 300;

/** How many composed cards are kept. A burst on one link is what this is for. */
const CACHE_SIZE = 64;

/**
 * The share card, composed on demand.
 *
 * Not written beside the preview at upload time: a card denormalizes the
 * document, its author and its star tally, and those move independently — a
 * rename, a new avatar, a star — so a stored card would need a re-compose
 * trigger per clock, and an author rename would fan out over every card they
 * own. Composing per request and hashing the inputs into the `ETag` makes
 * staleness impossible instead of merely unlikely; what it gives up is URL
 * immutability, which buys nothing, since platforms cache by `og:url` and
 * re-fetch the image when they re-scrape.
 *
 * A card is drawn only for documents the read through the same token answers —
 * it goes through `ShareService.resolve`, so a private document's card composes
 * for its owner and for nobody else. What the caller decides is whether there
 * is a card, never what is on it, which is why the composed card is cached by
 * the document alone.
 */
@Injectable()
export class ShareCardService {
  /**
   * Insertion-ordered, so the oldest key is the first one `keys()` yields.
   * Keyed by the kind as well as the token: the same uuid can name a row in
   * either table, and a card drawn for one must never answer for the other.
   */
  private readonly cache = new Map<string, ComposedCard>();
  /**
   * Cards being composed right now. A link pasted into a chat is fetched by
   * every unfurler at once, and composing it once per fetcher is the only way
   * this route costs real CPU.
   */
  private readonly inFlight = new Map<string, Promise<ComposedCard>>();

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly share: ShareService,
    private readonly storage: FileStorageService
  ) {}

  /**
   * The card for a document's link, composed or reused. `resolve` runs first
   * and is the access check: a card is only ever drawn for a document the
   * caller may read, so nothing below has to ask again.
   */
  async forLink(
    kind: ShareKind,
    link: string,
    callerId: string | null
  ): Promise<ShareCard> {
    const target = await this.share.resolve(kind, link, callerId);
    const [author, stars] = await Promise.all([
      this.author(target.row.userId),
      this.stars(target)
    ]);

    const etag = cardEtag(target, author, stars);
    const key = `${kind}:${link}`;
    // The state this request resolved, not the one a cached card was composed
    // under: it is the resolved state that says whether a stranger could have
    // fetched this at all.
    const publiclyReadable = target.row.visibility !== 'private';

    const cached = this.cache.get(key);
    if (cached?.etag === etag) return { ...cached, publiclyReadable };

    const pending = this.inFlight.get(etag);
    if (pending) return { ...(await pending), publiclyReadable };

    const composing = this.compose(target, author, stars, etag).finally(() =>
      this.inFlight.delete(etag)
    );
    this.inFlight.set(etag, composing);

    const card = await composing;
    this.remember(key, card);
    return { ...card, publiclyReadable };
  }

  private async compose(
    target: ShareTarget,
    author: CardAuthor,
    stars: number,
    etag: string
  ): Promise<ComposedCard> {
    const [render, avatar] = await Promise.all([
      target.kind === 'project' && target.row.previewId
        ? this.storage.readAsset('preview', target.row.previewId, RENDER_FILE)
        : null,
      author.avatarId
        ? this.storage.readAsset('profile', author.avatarId, AVATAR_FILE)
        : null
    ]);

    const input: ShareCardInput = {
      name: target.row.name,
      username: author.username,
      avatar,
      stars,
      // The host the deployment answers on, not the one this request named: a
      // card is chrome, and a `Host:` of somebody's choosing would end up in it.
      host: new URL(this.env.PUBLIC_URL).hostname,
      subject:
        target.kind === 'project'
          ? {
              kind: 'project',
              componentCount: target.row.componentCount,
              wireCount: target.row.wireCount,
              render
            }
          : componentSubject(target.row)
    };

    return { etag, png: await composeShareCard(input) };
  }

  private remember(key: string, card: ComposedCard): void {
    // Re-inserting moves the key to the end, so what falls out is the card
    // nobody has asked for in longest.
    this.cache.delete(key);
    this.cache.set(key, card);

    for (const stale of this.cache.keys()) {
      if (this.cache.size <= CACHE_SIZE) break;
      this.cache.delete(stale);
    }
  }

  private async author(userId: string): Promise<CardAuthor> {
    const [author] = await this.db
      .select({ username: users.username, avatarId: users.avatarId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // The owner column is `ON DELETE CASCADE`, so a document without one is a
    // defect rather than a case to handle.
    if (!author) {
      throw new Error(`Document owner ${userId} does not exist.`);
    }
    return author;
  }

  private stars(target: ShareTarget): Promise<number> {
    return target.kind === 'project'
      ? starTally(this.db, projectStars, projectStars.projectId, target.row.id)
      : starTally(
          this.db,
          componentStars,
          componentStars.componentId,
          target.row.id
        );
  }
}

interface CardAuthor {
  readonly username: string;
  readonly avatarId: string | null;
}

function componentSubject(row: ComponentRow): ShareCardInput['subject'] {
  return {
    kind: 'component',
    symbol: row.symbol,
    numInputs: row.numInputs,
    numOutputs: row.numOutputs,
    labels: row.labels
  };
}

/**
 * Everything the card draws, hashed — the layout included, so a redesign is not
 * answered `304` against the drawing it replaced. The preview and the avatar
 * enter as their asset ids: those directories are immutable, so a new id is
 * exactly what a replaced picture looks like.
 */
function cardEtag(
  target: ShareTarget,
  author: CardAuthor,
  stars: number
): string {
  const inputs = [
    CARD_LAYOUT_VERSION,
    target.kind,
    target.row.name,
    author.username,
    author.avatarId,
    stars,
    target.kind === 'project'
      ? [target.row.componentCount, target.row.wireCount, target.row.previewId]
      : [
          target.row.symbol,
          target.row.numInputs,
          target.row.numOutputs,
          target.row.labels
        ]
  ];

  const digest = createHash('sha256')
    .update(JSON.stringify(inputs))
    .digest('base64url')
    .slice(0, 27);

  return `"${digest}"`;
}
