import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LgAvatar, LgButton, LgDivider, LgPopover } from '@logigator/ui';
import { SessionService } from '../../user/session.service';
import { SiteLinks } from '../site-links';
import { SettingsPanel } from '../settings-panel/settings-panel';
import { TranslateDirective } from '../../translation/translate.directive';
import { NavDrawer } from '../nav-drawer/nav-drawer';
import { SITE_LOGO } from '../site-logo';
import {
  BUTTON_LINK_CLASS,
  BUTTON_LINK_OUTLINED_CLASS,
  MENU_LINK_CLASS,
  NAV_LINK_CLASS
} from '../link-classes';

/**
 * The site header. It renders personalized in the server's first byte: the
 * render forwards the visitor's session cookie on its API hop, so a signed-in
 * visitor sees no signed-out flash and hydration costs no request.
 *
 * Below the `md` breakpoint the links collapse into {@link NavDrawer}. The
 * language and theme controls are one component used in both places, rather
 * than the two independent copies the legacy header and burger menu carried.
 */
@Component({
  selector: 'web-top-bar',
  imports: [
    RouterLink,
    RouterLinkActive,
    LgAvatar,
    LgButton,
    LgDivider,
    LgPopover,
    SettingsPanel,
    NavDrawer,
    TranslateDirective
  ],
  templateUrl: './top-bar.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TopBar {
  protected readonly links = inject(SiteLinks);
  protected readonly session = inject(SessionService);

  private readonly settings = viewChild.required<LgPopover>('settings');
  private readonly account = viewChild.required<LgPopover>('account');

  protected readonly logo = SITE_LOGO;
  protected readonly navLinkClass = NAV_LINK_CLASS;
  protected readonly menuLinkClass = MENU_LINK_CLASS;
  protected readonly buttonLinkClass = BUTTON_LINK_CLASS;
  protected readonly buttonLinkOutlinedClass = BUTTON_LINK_OUTLINED_CLASS;

  protected readonly drawerOpen = signal(false);

  protected toggleSettings(event: Event): void {
    this.settings().toggle(event);
  }

  protected toggleAccount(event: Event): void {
    this.account().toggle(event);
  }

  protected logout(): void {
    // The signed-out header is the only feedback needed, and the API answers
    // 204 whether or not there was a session, so a failure here means the
    // request never landed and the session the header shows is still real.
    void this.session.logout().catch(() => undefined);
  }
}
