import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input
} from '@angular/core';
import { LgButton, LgDivider } from '@logigator/ui';
import { RETURN_PATH_PARAM } from '@logigator/core';
import { environment } from '../../../environments/environment';
import { AuthProvidersService } from '../../user/auth-providers.service';
import { TranslateDirective } from '../../translation/translate.directive';

/**
 * The Google entry point, shown only where the deployment has credentials for
 * it. A plain link, not a router one: the flow is a browser round trip through
 * the API and Google, so it has to leave the app.
 *
 * `returnUrl` rides along to the API, which keeps it with the flow and
 * redirects to it at the end — the parameter Google sees is `state`, and the
 * destination never leaves the origin.
 */
@Component({
  selector: 'web-google-sign-in',
  imports: [LgButton, LgDivider, TranslateDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (providers.googleAvailable()) {
      <div class="mt-6 flex flex-col gap-4" *webTranslate="let t">
        <div class="flex items-center gap-3 text-sm text-muted">
          <lg-divider class="flex-1" />
          <span>{{ t('auth.or') }}</span>
          <lg-divider class="flex-1" />
        </div>
        <a lgButton outlined severity="secondary" [href]="href()">
          <!-- Inline, so the mark needs no request and no consent, and one
               file serves both schemes. -->
          <svg class="size-5" viewBox="0 0 18 18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
            />
            <path
              fill="#FBBC05"
              d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
            />
          </svg>
          {{ t('auth.continueWithGoogle') }}
        </a>
      </div>
    }
  `
})
export class GoogleSignIn {
  /** Where the round trip should end, as a path on this origin. */
  readonly returnPath = input<string | null>(null);

  protected readonly providers = inject(AuthProvidersService);

  protected readonly href = computed(() => {
    const start = `${environment.apiUrl}/api/auth/google`;
    const destination = this.returnPath();
    return destination
      ? `${start}?${RETURN_PATH_PARAM}=${encodeURIComponent(destination)}`
      : start;
  });
}
