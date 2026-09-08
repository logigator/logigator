import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SessionService } from '../../user/session.service';
import { SiteLinks } from '../site-links';
import { TranslateDirective } from '../../translation/translate.directive';
import { NavDrawer } from '../nav-drawer/nav-drawer';
import { UserMenu } from '../user-menu/user-menu';
import { SITE_LOGO } from '../site-logo';
import { BAR_LINK_ACTIVE_CLASS, BAR_LINK_CLASS } from '../link-classes';

/**
 * The site bar. It renders personalized in the server's first byte: the render
 * forwards the visitor's session cookie on its API hop, so a signed-in visitor
 * sees no signed-out flash and hydration costs no request.
 *
 * One 56px green bar at every width, which is the treatment the editor's title
 * bar carries: the primary scale is scheme-independent, so the bar and its ink
 * are the same in light and dark. Below `md` the navigation links collapse into
 * {@link NavDrawer}; the account control stays, and with it the site's only
 * language and theme controls — hence no gear, and no auth buttons.
 */
@Component({
  selector: 'web-top-bar',
  imports: [
    RouterLink,
    RouterLinkActive,
    NavDrawer,
    UserMenu,
    TranslateDirective
  ],
  templateUrl: './top-bar.html',
  // The bar sticks from the host, not from the `<header>` inside it: a sticky
  // box travels only within its parent's box, and the parent of anything in
  // this template is the host — one bar tall, so a sticky `<header>` has
  // nowhere to travel. The host is what the shell's flex column lays out.
  host: { class: 'block sticky top-0 z-navbar' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TopBar {
  protected readonly links = inject(SiteLinks);
  protected readonly session = inject(SessionService);

  protected readonly logo = SITE_LOGO;
  protected readonly barLinkClass = BAR_LINK_CLASS;
  protected readonly barLinkActiveClass = BAR_LINK_ACTIVE_CLASS;

  protected readonly drawerOpen = signal(false);
}
