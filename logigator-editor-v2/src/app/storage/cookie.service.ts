import { inject, Injectable, OnDestroy } from '@angular/core';
import { SignalMap } from 'ngxtension/collections';
import { LoggingService } from '../logging/logging.service';

@Injectable({ providedIn: 'root' })
export class CookieService implements OnDestroy {
  private readonly loggingService = inject(LoggingService);
  private readonly _hasCookieStore = 'cookieStore' in window;
  private readonly _cookies = new SignalMap<string, string>();

  private readonly _changeHandler = (e: CookieChangeEvent) =>
    this._handleChange(e);

  constructor() {
    this._read().catch((e) => {
      this.loggingService.error(
        `Failed to read cookies: ${e}`,
        'CookieService'
      );
    });

    if (this._hasCookieStore) {
      window.cookieStore.addEventListener('change', this._changeHandler);
    }
  }

  ngOnDestroy(): void {
    if (this._hasCookieStore) {
      window.cookieStore.removeEventListener('change', this._changeHandler);
    }
  }

  get(name: string): string | null {
    return this._cookies.get(name) ?? null;
  }

  getAll(): Record<string, string> {
    return Array.from(this._cookies.entries()).reduce(
      (acc, [name, value]) => {
        acc[name] = value;
        return acc;
      },
      {} as Record<string, string>
    );
  }

  private async _read(): Promise<void> {
    if (this._hasCookieStore) {
      const cookies = await window.cookieStore.getAll();
      for (const { name, value } of cookies) {
        if (!name || !value) continue;
        this._cookies.set(name, value);
      }

      return;
    }

    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, ...rest] = cookie.split('=');
      const value = rest.join('=');
      if (!name || !value) continue;
      this._cookies.set(name.trim(), value.trim());
    }
  }

  private _handleChange(event: CookieChangeEvent): void {
    for (const { name, value } of event.changed) {
      if (!name || !value) return;
      this._cookies.set(name, value);
    }
    for (const { name } of event.deleted) {
      if (!name) return;
      this._cookies.delete(name);
    }
  }
}
