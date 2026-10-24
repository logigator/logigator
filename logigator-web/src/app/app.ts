import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { LgConfirmDialog, LgConsentBanner, LgToast } from '@logigator/ui';
import { ConsentService } from './consent/consent.service';
import { TopBar } from './layout/top-bar/top-bar';
import { Footer } from './layout/footer/footer';
import { TranslateDirective } from './translation/translate.directive';

/**
 * The site shell every route renders inside: header, content, footer, and the
 * two imperative surfaces behind them — the toast that replaces the legacy
 * one-shot info popups (server-rendered modal dialogs keyed on a session flash,
 * where a toast says the same thing without interrupting), and the confirmation
 * modal the account pages ask through before anything irreversible — plus the
 * consent bar, for a visitor who has not answered yet.
 */
@Component({
  selector: 'web-root',
  imports: [
    RouterLink,
    RouterOutlet,
    LgConfirmDialog,
    LgConsentBanner,
    LgToast,
    TopBar,
    Footer,
    TranslateDirective
  ],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  protected readonly consent = inject(ConsentService);
}
