import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteLinks } from '../../layout/site-links';
import { TranslateDirective } from '../../translation/translate.directive';
import { NotFoundStatus } from './not-found-status';

@Component({
  selector: 'web-not-found-page',
  imports: [RouterLink, TranslateDirective],
  templateUrl: './not-found-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotFoundPage {
  protected readonly links = inject(SiteLinks);

  constructor() {
    // A page rendered on the server must answer 404, not 200: a soft 404 is
    // indexable, and a crawler has no other way to learn the URL is dead.
    inject(NotFoundStatus).mark();
  }
}
