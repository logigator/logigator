import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

/** Where Turnstile's script and its challenge frame come from. */
export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

/**
 * Explicit rendering: the script only defines `window.turnstile`, and each
 * widget renders where and when its component says.
 */
const SCRIPT_URL = `${TURNSTILE_ORIGIN}/turnstile/v0/api.js?render=explicit`;

/** What a widget's callbacks and options are; only what the site sets. */
export interface TurnstileRenderOptions {
  sitekey: string;
  action: string;
  theme: 'light' | 'dark';
  language: string;
  size: 'flexible';
  /** Off: the token goes in the request body, not a hidden input. */
  'response-field': false;
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
}

/** The part of Cloudflare's `window.turnstile` the site calls. */
export interface TurnstileApi {
  render(
    container: HTMLElement,
    options: TurnstileRenderOptions
  ): string | undefined;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

type TurnstileWindow = Window & { turnstile?: TurnstileApi };

/**
 * Loads Cloudflare's script once per page, on first use, so pages without a
 * form never fetch it. The policy allows it by host, so it needs no nonce.
 */
@Injectable({ providedIn: 'root' })
export class TurnstileLoader {
  private readonly document = inject(DOCUMENT);
  private loading: Promise<TurnstileApi> | null = null;

  public load(): Promise<TurnstileApi> {
    const window = this.document.defaultView as TurnstileWindow | null;
    if (window?.turnstile) return Promise.resolve(window.turnstile);

    this.loading ??= new Promise<TurnstileApi>((resolve, reject) => {
      const script = this.document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = () => {
        if (window?.turnstile) resolve(window.turnstile);
        else this.fail(script, reject);
      };
      script.onerror = () => this.fail(script, reject);
      this.document.head.appendChild(script);
    });
    return this.loading;
  }

  /** Forgets a failed load, so the next form tries again. */
  private fail(script: HTMLScriptElement, reject: (error: Error) => void) {
    script.remove();
    this.loading = null;
    reject(new Error('The Turnstile script did not load'));
  }
}
