import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteLinks } from '../site-links';
import { TranslateDirective } from '../../translation/translate.directive';

@Component({
  selector: 'web-footer',
  imports: [RouterLink, TranslateDirective],
  templateUrl: './footer.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Footer {
  protected readonly links = inject(SiteLinks);
}
