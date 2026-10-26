import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  type Signal
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RETURN_PATH_PARAM } from '@logigator/core';
import { LgButton, LgMessage } from '@logigator/ui';
import { environment } from '../../../../environments/environment';
import { TranslateDirective } from '../../../translation/translate.directive';
import { TranslationKey } from '../../../translation/translation-key.model';
import { googleErrorKey } from '../../../user/google-auth-errors';

/**
 * Marks the account page a Google round trip returns to, naming the action it
 * was started to finish.
 */
export const RESUME_PARAM = 'resume';

/** The account changes a member without a password signs in again for. */
export type ResumableAction = 'delete' | 'email' | 'password';

/** How the round trip ended, and what the member had typed before it. */
export interface ReauthenticationReturn {
  failure: TranslationKey | null;
  draft: string | null;
}

export interface ReauthenticationOptions {
  /**
   * What the member typed, kept in this tab across the round trip; read as
   * they leave, so an edit after the prompt appeared is the one kept. Nothing
   * secret belongs in it.
   */
  draft?: () => string;
  onReturn: (outcome: ReauthenticationReturn) => void;
}

/**
 * A section's way through the API's `reauthentication_required`: a Google
 * round trip that signs the account in again and comes back to this page
 * marked with the action, so the section can finish it.
 */
export interface GoogleReauthentication {
  /** Whether the section is showing the prompt instead of its own submit. */
  readonly required: Signal<boolean>;
  /** The API's Google start route, returning to this page marked to resume. */
  readonly url: Signal<string>;
  require(): void;
  dismiss(): void;
  /** Keeps the draft, as the browser leaves for the round trip. */
  leave(): void;
}

/**
 * Wires a section to the round trip. Back from it, the marker and any failure
 * leave the URL, so a reload does not resume twice, and `onReturn` gets the
 * outcome; a failure shows the prompt again.
 *
 * Must run in an injection context.
 */
export function googleReauthentication(
  action: ResumableAction,
  options: ReauthenticationOptions
): GoogleReauthentication {
  const router = inject(Router);
  const route = inject(ActivatedRoute);
  const required = signal(false);
  const draftKey = `account.resume.${action}`;

  const url = computed(() => {
    const destination = router.parseUrl(router.url);
    destination.queryParams = { [RESUME_PARAM]: action };
    destination.fragment = null;
    const returnPath = encodeURIComponent(router.serializeUrl(destination));
    return `${environment.apiUrl}/api/auth/google?${RETURN_PATH_PARAM}=${returnPath}`;
  });

  afterNextRender(async () => {
    const query = route.snapshot.queryParamMap;
    if (query.get(RESUME_PARAM) !== action) return;

    const failure = googleErrorKey(query.get('error'));
    const draft = takeDraft(draftKey);
    await router.navigate([], {
      relativeTo: route,
      queryParams: { [RESUME_PARAM]: null, error: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });

    if (failure) required.set(true);
    options.onReturn({ failure, draft });
  });

  return {
    required: required.asReadonly(),
    url,
    require: () => required.set(true),
    dismiss: () => required.set(false),
    leave: () => {
      const draft = options.draft?.();
      if (draft) writeDraft(draftKey, draft);
    }
  };
}

function writeDraft(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Storage can be missing or refused (a private window, blocked site data),
    // and the draft is a convenience: the round trip goes on without it.
  }
}

function takeDraft(key: string): string | null {
  try {
    const value = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return value;
  } catch {
    return null;
  }
}

/** The prompt a section shows in place of its submit. */
@Component({
  selector: 'web-account-reauthentication',
  imports: [LgButton, LgMessage, TranslateDirective],
  host: { class: 'flex flex-col gap-4' },
  template: `
    <ng-container *webTranslate="let t">
      <lg-message severity="info">{{ message() }}</lg-message>
      <div>
        <!-- A plain link: the round trip leaves the app for the API and Google. -->
        <a
          lgButton
          outlined
          severity="secondary"
          [href]="flow().url()"
          (click)="flow().leave()"
        >
          {{ t('auth.continueWithGoogle') }}
        </a>
      </div>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountReauthentication {
  readonly message = input.required<string>();
  readonly flow = input.required<GoogleReauthentication>();
}
