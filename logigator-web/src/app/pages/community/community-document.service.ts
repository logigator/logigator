import {
  computed,
  inject,
  Injectable,
  makeStateKey,
  signal
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { isApiError } from '@logigator/contract';
import type {
  CommunityComponentDetail,
  CommunityProjectDetail
} from '@logigator/contract';
import type { CommunityKind } from '../../api/services/community-api.service';
import { CommunityApiService } from '../../api/services/community-api.service';
import { genericFailureKey } from '../../forms/api-failure';
import { TransferHandoffService } from '../../transfer/transfer-handoff.service';
import { TranslationKey } from '../../translation/translation-key.model';

/** Either detail shape; `kind` says which, and a component adds its ports. */
export type CommunityDocument =
  | ({ kind: 'projects' } & CommunityProjectDetail)
  | ({ kind: 'components' } & CommunityComponentDetail);

/**
 * What the read produced. A missing document is its own outcome rather than a
 * failure: the page answers 404 for it, and a 503 keeps the page with a retry.
 */
type DetailResult =
  | { document: CommunityDocument }
  | { missing: true }
  | { failureKey: TranslationKey };

const DETAIL_STATE = makeStateKey<DetailResult>('community.document');

/**
 * One published document's own page.
 *
 * Resolved by a guard so the first byte carries the circuit, its author and its
 * star count — which is also what lets the head name the document rather than a
 * translation key, and the JSON-LD graph describe what the page actually
 * rendered.
 */
@Injectable({ providedIn: 'root' })
export class CommunityDocumentService {
  private readonly communityApi = inject(CommunityApiService);
  private readonly handoff = inject(TransferHandoffService);

  private readonly result = signal<DetailResult>({ missing: true });
  /** Overrides the resolved tally once the reader has toggled their star. */
  private readonly starOverride = signal<{
    starred: boolean;
    stars: number;
  } | null>(null);
  private readonly _pendingAction = signal<'star' | 'clone' | null>(null);
  private readonly _retrying = signal(false);
  private readonly _actionFailureKey = signal<TranslationKey | null>(null);
  /** What the last resolve addressed, so a retry asks for the same thing. */
  private target: { kind: CommunityKind; link: string } | null = null;

  public readonly document = computed(() => {
    const current = this.result();
    return 'document' in current ? current.document : null;
  });

  /** True where the link names nothing published — the page's own 404. */
  public readonly missing = computed(() => 'missing' in this.result());

  public readonly failureKey = computed(() => {
    const current = this.result();
    return 'failureKey' in current ? current.failureKey : null;
  });

  /** The star state as it stands, the reader's own toggle included. */
  public readonly stars = computed(
    () => this.starOverride()?.stars ?? this.document()?.stars ?? 0
  );
  public readonly starred = computed(
    () => this.starOverride()?.starred ?? this.document()?.starred ?? false
  );

  /**
   * Which action is in flight, not whether one is: the two controls sit beside
   * each other, so a boolean would busy the button the reader did not press.
   */
  public readonly pendingAction = this._pendingAction.asReadonly();
  /** Why the last action failed, for the message beside the controls. */
  public readonly actionFailureKey = this._actionFailureKey.asReadonly();
  public readonly retrying = this._retrying.asReadonly();

  public async resolve(kind: CommunityKind, link: string): Promise<void> {
    this.starOverride.set(null);
    this._actionFailureKey.set(null);
    this.target = { kind, link };
    this.result.set(
      await this.handoff.resolve(DETAIL_STATE, () => this.fetch(kind, link))
    );
  }

  /**
   * Asks again after a read that failed. Not through the hand-off: what it
   * holds is the answer that failed.
   */
  public async retry(): Promise<void> {
    if (!this.target || this._retrying()) return;
    this._retrying.set(true);
    try {
      this.result.set(await this.fetch(this.target.kind, this.target.link));
    } finally {
      this._retrying.set(false);
    }
  }

  /**
   * Sets the star to what the reader asked for. `PUT`/`DELETE` state the state
   * they want, so the count comes back from the server rather than being
   * guessed here — a second reader's star between two clicks would otherwise
   * leave the tally one out.
   */
  public async setStar(starred: boolean): Promise<void> {
    const document = this.document();
    if (!document || this._pendingAction()) return;

    this.beginAction('star');
    try {
      this.starOverride.set(
        await firstValueFrom(
          this.communityApi.setStar(document.kind, document.link, starred)
        )
      );
    } catch (error) {
      this.failAction(error);
      return;
    }
    this._pendingAction.set(null);
  }

  public beginAction(action: 'star' | 'clone'): void {
    this._pendingAction.set(action);
    this._actionFailureKey.set(null);
  }

  public failAction(error: unknown): void {
    this._actionFailureKey.set(genericFailureKey(error));
    this._pendingAction.set(null);
  }

  private async fetch(
    kind: CommunityKind,
    link: string
  ): Promise<DetailResult> {
    try {
      const document =
        kind === 'projects'
          ? {
              kind: 'projects' as const,
              ...(await firstValueFrom(this.communityApi.projectDetail(link)))
            }
          : {
              kind: 'components' as const,
              ...(await firstValueFrom(this.communityApi.componentDetail(link)))
            };
      return { document };
    } catch (error) {
      // A link naming nothing published is indistinguishable from one that
      // never existed, deliberately: the API answers `not_found` either way,
      // and so does this page.
      if (isApiError(error, 'not_found')) {
        return { missing: true };
      }
      return { failureKey: genericFailureKey(error) };
    }
  }
}
