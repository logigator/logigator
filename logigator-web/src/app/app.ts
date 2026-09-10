import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { LgConfirmDialog, LgToast } from '@logigator/ui';
import { TopBar } from './layout/top-bar/top-bar';
import { Footer } from './layout/footer/footer';
import { TranslateDirective } from './translation/translate.directive';

/**
 * The site shell every route renders inside: header, content, footer, and the
 * two imperative surfaces behind them — the toast that replaces the legacy
 * one-shot info popups (server-rendered modal dialogs keyed on a session flash,
 * where a toast says the same thing without interrupting), and the confirmation
 * modal the account pages ask through before anything irreversible.
 */
@Component({
  selector: 'web-root',
  imports: [
    RouterLink,
    RouterOutlet,
    LgConfirmDialog,
    LgToast,
    TopBar,
    Footer,
    TranslateDirective
  ],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {}
