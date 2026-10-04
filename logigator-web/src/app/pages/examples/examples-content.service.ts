import { inject, Injectable } from '@angular/core';
import { CommunityApiService } from '../../api/services/community-api.service';
import { environment } from '../../../environments/environment';
import { contentSection } from '../../transfer/content-section';

/**
 * The API's cap on a page, so the list the page draws is the whole list. The
 * seed account is curated rather than browsed — there is no pagination here,
 * and a hundredth example is a content problem, not a paging one.
 */
const PAGE_SIZE = 100;

/**
 * Every example the seed account publishes, in one read. The examples are that
 * account's public projects, so editing one is a save in the editor rather than
 * a deploy.
 */
@Injectable({ providedIn: 'root' })
export class ExamplesContentService {
  private readonly communityApi = inject(CommunityApiService);

  public readonly examples = contentSection('examples.list', () =>
    this.communityApi.userProjects(environment.exampleUserId, {
      size: PAGE_SIZE
    })
  );

  public resolve(): Promise<void> {
    return this.examples.resolve();
  }
}
