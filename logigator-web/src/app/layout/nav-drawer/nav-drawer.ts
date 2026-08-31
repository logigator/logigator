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
import { SettingsPanel } from '../settings-panel/settings-panel';
import { TranslateDirective } from '../../translation/translate.directive';
import { MENU_LINK_CLASS } from '../link-classes';

/**
 * The compact-viewport navigation: the header's links plus the settings pair,
 * in a drawer. `visible` is one-way, as `LgDrawer`'s own is — the header owns
 * the state and re-derives it from `visibleChange`.
 */
@Component({
  selector: 'web-nav-drawer',
  imports: [
    RouterLink,
    RouterLinkActive,
    LgDivider,
    LgDrawer,
    SettingsPanel,
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
