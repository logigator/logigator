import {
  computed,
  inject,
  Injectable,
  makeStateKey,
  signal
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { isApiError, type ShareResponse } from '@logigator/contract';
import type { CommunityKind } from '../../api/services/community-api.service';
import { ShareApiService } from '../../api/services/share-api.service';
import { genericFailureKey } from '../../forms/api-failure';
import { TransferHandoffService } from '../../transfer/transfer-handoff.service';
import { TranslationKey } from '../../translation/translation-key.model';

/**
 * What the read produced. A token that resolves to nothing is its own outcome
 * rather than a failure: the page answers 404 for it, and a read that failed
 * keeps the page with a retry.
 */
type LandingResult =
  | { shared: ShareResponse }
  | { missing: true }
  | { failureKey: TranslationKey };

const LANDING_STATE = makeStateKey<LandingResult>('share.landing');

/**
 * The document behind a share link, for the page that link lands on.
 *
 * A link is a **capability**: the read needs no session and ignores whether the
 * document is public, so this page is reachable by whoever the URL was given
 * to. It is kept out of indexes rather than out of reach — see the route's
 * `noindex` and `robots.ts`.
 *
 * Resolved by a guard, so the first byte carries the circuit, its author and
 * the card the link unfurls as, rather than a translation key.
 */
@Injectable({ providedIn: 'root' })
export class ShareLandingService {
  private readonly shareApi = inject(ShareApiService);
  private readonly handoff = inject(TransferHandoffService);

  private readonly result = signal<LandingResult>({ missing: true });
  private readonly _cloning = signal(false);
  private readonly _retrying = signal(false);
  private readonly _actionFailureKey = signal<TranslationKey | null>(null);
  /** What the last resolve addressed, so a retry asks for the same thing. */
  private link: string | null = null;

  public readonly share = computed(() => {
    const current = this.result();
    return 'shared' in current ? current.shared : null;
  });

  /**
   * The summary, whichever kind it is. Every field the page and its head draw —
   * name, description, counts, preview, link — is on the half the two arms
   * share, so the narrowing is made once here rather than at each reader.
   */
  public readonly summary = computed(() => {
    const share = this.share();
    if (!share) return null;
    return share.kind === 'project' ? share.project : share.component;
  });

  /** True where the token names nothing — a link that was regenerated. */
  public readonly missing = computed(() => 'missing' in this.result());

  public readonly failureKey = computed(() => {
    const current = this.result();
    return 'failureKey' in current ? current.failureKey : null;
  });

  /**
   * The kind as this site spells it. The API says `project` and `component`
   * while the routes say `projects` and `components`, so the mapping is made
   * here and nowhere else: a link built from the API's spelling answers 404,
   * and the page that built it has no way to notice.
   */
  public readonly kind = computed<CommunityKind>(() =>
    this.share()?.kind === 'component' ? 'components' : 'projects'
  );

  public readonly cloning = this._cloning.asReadonly();
  /** Why the clone failed, for the message beside the controls. */
  public readonly actionFailureKey = this._actionFailureKey.asReadonly();
  public readonly retrying = this._retrying.asReadonly();

  public async resolve(link: string): Promise<void> {
    this._actionFailureKey.set(null);
    this.link = link;
    this.result.set(
      await this.handoff.resolve(LANDING_STATE, () => this.fetch(link))
    );
  }

  /**
   * Asks again after a read that failed. Not through the hand-off: what it
   * holds is the answer that failed.
   */
  public async retry(): Promise<void> {
    if (!this.link || this._retrying()) return;
    this._retrying.set(true);
    try {
      this.result.set(await this.fetch(this.link));
    } finally {
      this._retrying.set(false);
    }
  }

  public beginClone(): void {
    this._cloning.set(true);
    this._actionFailureKey.set(null);
  }

  public failClone(error: unknown): void {
    this._actionFailureKey.set(genericFailureKey(error));
    this._cloning.set(false);
  }

  private async fetch(link: string): Promise<LandingResult> {
    try {
      return { shared: await firstValueFrom(this.shareApi.read(link)) };
    } catch (error) {
      // A token that was regenerated and one that never existed are the same
      // answer, deliberately: revoking a link has to take its page down.
      if (isApiError(error, 'not_found')) {
        return { missing: true };
      }
      return { failureKey: genericFailureKey(error) };
    }
  }
}
