import {
  computed,
  inject,
  Injectable,
  makeStateKey,
  signal,
  StateKey,
  Signal
} from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import type { CommunityComponent, CommunityProject } from '@logigator/contract';
import { CommunityApiService } from '../../api/services/community-api.service';
import { environment } from '../../../environments/environment';
import { genericFailureKey } from '../../forms/api-failure';
import { TransferHandoffService } from '../../transfer/transfer-handoff.service';
import { TranslationKey } from '../../translation/translation-key.model';

/** Six, so the rail overflows its frame at every width. */
const EXAMPLE_COUNT = 6;
/** Four, so the grid fills exactly one row. */
const COMMUNITY_COUNT = 4;

/**
 * The failure travels as a translation key rather than as the error: it has to
 * cross the server/browser boundary as JSON, and the API's own message is
 * English on a four-language site.
 */
type SectionResult<TRow> =
  { entries: readonly TRow[] } | { failureKey: TranslationKey };

const EXAMPLES_STATE =
  makeStateKey<SectionResult<CommunityProject>>('home.examples');
const PROJECTS_STATE =
  makeStateKey<SectionResult<CommunityProject>>('home.projects');
const COMPONENTS_STATE =
  makeStateKey<SectionResult<CommunityComponent>>('home.components');

/** `entries` is empty for a working API with nothing published, `null` for a
 * read that failed. */
export interface ContentSection<TRow> {
  readonly entries: Signal<readonly TRow[] | null>;
  readonly failureKey: Signal<TranslationKey | null>;
  readonly retrying: Signal<boolean>;
  resolve(): Promise<void>;
  retry(): Promise<void>;
}

/**
 * The three lists the home page shows: the example account's projects, and the
 * community's top projects and components.
 *
 * A read that fails resolves to a value rather than rejecting. Rejecting would
 * transfer nothing, so hydration would silently repeat a request that has
 * already failed once.
 */
@Injectable({ providedIn: 'root' })
export class HomeContentService {
  private readonly communityApi = inject(CommunityApiService);
  private readonly handoff = inject(TransferHandoffService);

  public readonly examples = this.section(EXAMPLES_STATE, () =>
    this.communityApi.userProjects(environment.exampleUserId, {
      size: EXAMPLE_COUNT
    })
  );

  public readonly projects = this.section(PROJECTS_STATE, () =>
    this.communityApi.projects({ size: COMMUNITY_COUNT, orderBy: 'stars' })
  );

  public readonly components = this.section(COMPONENTS_STATE, () =>
    this.communityApi.components({ size: COMMUNITY_COUNT, orderBy: 'stars' })
  );

  public async resolve(): Promise<void> {
    await Promise.all([
      this.examples.resolve(),
      this.projects.resolve(),
      this.components.resolve()
    ]);
  }

  private section<TRow>(
    key: StateKey<SectionResult<TRow>>,
    read: () => Observable<{ entries: TRow[] }>
  ): ContentSection<TRow> {
    const result = signal<SectionResult<TRow>>({ entries: [] });
    const retrying = signal(false);

    const fetch = async (): Promise<SectionResult<TRow>> => {
      try {
        return { entries: (await firstValueFrom(read())).entries };
      } catch (error) {
        return { failureKey: genericFailureKey(error) };
      }
    };

    return {
      entries: computed(() => {
        const current = result();
        return 'entries' in current ? current.entries : null;
      }),
      failureKey: computed(() => {
        const current = result();
        return 'failureKey' in current ? current.failureKey : null;
      }),
      retrying: retrying.asReadonly(),
      resolve: async () => {
        result.set(await this.handoff.resolve(key, fetch));
      },
      // Not through the hand-off: what it holds is the answer that failed.
      retry: async () => {
        retrying.set(true);
        try {
          result.set(await fetch());
        } finally {
          retrying.set(false);
        }
      }
    };
  }
}
