import { Injectable, signal } from '@angular/core';

/**
 * Loads the backend-served cookie-consent bundle (vanilla-cookieconsent plus
 * the shared config; see `src/consent.d.ts`). The script tag is created at
 * runtime because the dev server rewrites root-relative URLs in static
 * index.html tags under the /editor/ base href. Without the backend on the
 * same origin (bare `ng serve`) the script 404s and consent simply stays
 * unavailable.
 */
@Injectable({ providedIn: 'root' })
export class ConsentService {
  private readonly _available = signal(false);

  /** Whether the consent bundle has loaded and preferences can be managed. */
  public readonly available = this._available.asReadonly();

  /** Injects the consent bundle. Called once at app startup. */
  public load(): void {
    if (window.CookieConsent) {
      this._available.set(true);
      return;
    }
    const script = document.createElement('script');
    script.src = '/js/cookieconsent.js';
    script.onload = () => this._available.set(true);
    document.head.appendChild(script);
  }

  /** Opens the banner's preferences dialog. No-op while unavailable. */
  public showPreferences(): void {
    window.CookieConsent?.showPreferences();
  }
}
