import { inject, Injectable } from '@angular/core';
import { CommunityApiService } from '../../api/services/community-api.service';
import { EXAMPLES_ACCOUNT_ID } from '@logigator/core';
import { contentSection } from '../../transfer/content-section';
import { TranslationService } from '../../translation/translation.service';

/** Six, so the rail overflows its frame at every width. */
const EXAMPLE_COUNT = 6;
/** Four, so the grid fills exactly one row. */
const COMMUNITY_COUNT = 4;

/**
 * The three lists the home page shows: the example account's projects, and the
 * community's top projects and components.
 */
@Injectable({ providedIn: 'root' })
export class HomeContentService {
  private readonly communityApi = inject(CommunityApiService);
  private readonly translation = inject(TranslationService);

  public readonly examples = contentSection('home.examples', () =>
    this.communityApi.userProjects(EXAMPLES_ACCOUNT_ID, {
      size: EXAMPLE_COUNT,
      lang: this.translation.getActiveLang()
    })
  );

  public readonly projects = contentSection('home.projects', () =>
    this.communityApi.projects({
      size: COMMUNITY_COUNT,
      orderBy: 'stars',
      lang: this.translation.getActiveLang()
    })
  );

  public readonly components = contentSection('home.components', () =>
    this.communityApi.components({
      size: COMMUNITY_COUNT,
      orderBy: 'stars',
      lang: this.translation.getActiveLang()
    })
  );

  public async resolve(): Promise<void> {
    await Promise.all([
      this.examples.resolve(),
      this.projects.resolve(),
      this.components.resolve()
    ]);
  }
}
