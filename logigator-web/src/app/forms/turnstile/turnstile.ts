import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild
} from '@angular/core';
import type { TurnstileAction } from '@logigator/contract';
import { DeploymentService } from '../../api/deployment.service';
import { ThemingService } from '../../theming/theming.service';
import { TranslationService } from '../../translation/translation.service';
import { TurnstileApi, TurnstileLoader } from './turnstile-loader';

/**
 * Cloudflare's challenge in managed mode, for a form whose request the API
 * verifies. Rendered in the browser only; the server render leaves its space.
 * The site key is the deployment's, from `GET /meta`; a deployment without one
 * runs no challenge, and the widget takes no room once that is known.
 *
 * The form reads {@link token} when it submits and sends the request without
 * one if the widget failed or never loaded, since the API decides whether a
 * challenge is needed. A token is spent by the request that carries it, so
 * the form calls {@link reset} after every failed submit.
 *
 * A change of theme or language renders the widget again, which costs the
 * solved token.
 */
@Component({
  selector: 'web-turnstile',
  template: '<div #container class="min-h-[65px]"></div>',
  host: { class: 'block', '[class.hidden]': '!enabled()' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Turnstile {
  private readonly loader = inject(TurnstileLoader);
  private readonly theming = inject(ThemingService);
  private readonly translation = inject(TranslationService);
  private readonly deployment = inject(DeploymentService);

  private readonly container =
    viewChild.required<ElementRef<HTMLElement>>('container');

  /** Which form this is, so the API refuses a token solved for another. */
  public readonly action = input.required<TurnstileAction>();

  /** Until the deployment is known, the challenge is assumed and its room kept. */
  protected readonly enabled = computed(
    () => !this.deployment.resolved() || !!this.deployment.turnstileSiteKey()
  );

  private readonly api = signal<TurnstileApi | null>(null);
  private widgetId: string | undefined;

  private readonly _token = signal<string | null>(null);
  /** The solved challenge, or `null` while there is none to send. */
  public readonly token = this._token.asReadonly();

  constructor() {
    let destroyed = false;
    inject(DestroyRef).onDestroy(() => (destroyed = true));

    const load = () => {
      if (destroyed || !this.deployment.turnstileSiteKey()) return;
      this.loader.load().then(
        (api) => {
          if (!destroyed) this.api.set(api);
        },
        // Without the script there is no token, and the API answers the
        // submit with the message the form shows.
        () => undefined
      );
    };

    // A page whose guard resolved the deployment starts the script at once;
    // a dialog opened later asks for it first.
    afterNextRender(() => {
      if (this.deployment.resolved()) load();
      else void this.deployment.resolve().then(load);
    });

    effect((onCleanup) => {
      const api = this.api();
      const sitekey = this.deployment.turnstileSiteKey();
      if (!api || !sitekey) return;

      const widgetId = api.render(this.container().nativeElement, {
        sitekey,
        action: this.action(),
        theme: this.theming.theme(),
        language: this.translation.activeLang(),
        size: 'flexible',
        'response-field': false,
        callback: (token) => this._token.set(token),
        'expired-callback': () => this._token.set(null),
        'error-callback': () => this._token.set(null)
      });
      this.widgetId = widgetId;

      onCleanup(() => {
        this._token.set(null);
        this.widgetId = undefined;
        if (widgetId !== undefined) api.remove(widgetId);
      });
    });
  }

  /** Drops the token and asks for a fresh one. */
  public reset(): void {
    this._token.set(null);
    const api = this.api();
    if (api && this.widgetId !== undefined) api.reset(this.widgetId);
  }
}
