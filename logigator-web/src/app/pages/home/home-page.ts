import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SiteLinks } from '../../layout/site-links';
import { TranslateDirective } from '../../translation/translate.directive';
import { BUTTON_LINK_CLASS } from '../../layout/link-classes';

/**
 * The landing page. Phase 5a puts the shell around it; the hero, feature
 * overview, example teasers and community teasers are Phase 5c.
 */
@Component({
  selector: 'web-home-page',
  imports: [TranslateDirective],
  templateUrl: './home-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomePage {
  protected readonly links = inject(SiteLinks);
  protected readonly buttonLinkClass = BUTTON_LINK_CLASS;
}
