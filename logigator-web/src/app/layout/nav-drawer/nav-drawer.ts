import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LgDivider, LgDrawer } from '@logigator/ui';
import { SessionService } from '../../user/session.service';
import { SiteLinks } from '../site-links';
import { TranslateDirective } from '../../translation/translate.directive';
import { MENU_LINK_CLASS } from '../link-classes';

/**
 * The compact-viewport navigation: the destinations the bar drops below `md`,
 * and nothing else — the account rows and the language and theme controls are
 * in the account panel, which the bar keeps at every width. `visible` is
 * one-way, as `LgDrawer`'s own is — the bar owns the state and re-derives it
 * from `visibleChange`.
 */
@Component({
  selector: 'web-nav-drawer',
  imports: [
    RouterLink,
    RouterLinkActive,
    LgDivider,
    LgDrawer,
    TranslateDirective
  ],
  templateUrl: './nav-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavDrawer {
  public readonly visible = input(false);
  public readonly visibleChange = output<boolean>();

  protected readonly links = inject(SiteLinks);
  protected readonly session = inject(SessionService);
  protected readonly menuLinkClass = MENU_LINK_CLASS;

  protected close(): void {
    this.visibleChange.emit(false);
  }
}
