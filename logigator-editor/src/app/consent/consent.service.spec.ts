import { describe, it, expect, afterEach } from 'vitest';
import { ConsentService } from './consent.service';

const SELECTOR = 'script[src$="/js/cookieconsent.js"]';

/** Runs `load()` and returns the script element that call injected. */
function loadWithInjectedScript(service: ConsentService): Element | undefined {
  const before = new Set(document.head.querySelectorAll(SELECTOR));
  service.load();
  return Array.from(document.head.querySelectorAll(SELECTOR)).find(
    (s) => !before.has(s)
  );
}

describe('ConsentService', () => {
  afterEach(() => {
    document.head.querySelectorAll(SELECTOR).forEach((s) => s.remove());
    delete window.CookieConsent;
  });

  it('becomes available only once the bundle script has loaded', () => {
    const service = new ConsentService();
    const script = loadWithInjectedScript(service);

    expect(script).toBeDefined();
    expect(service.available()).toBe(false);

    script!.dispatchEvent(new Event('load'));
    expect(service.available()).toBe(true);
  });

  it('stays unavailable when the bundle never loads', () => {
    const service = new ConsentService();
    const script = loadWithInjectedScript(service);

    script!.dispatchEvent(new Event('error'));
    expect(service.available()).toBe(false);
  });

  it('skips injection when the bundle is already present', () => {
    window.CookieConsent = {
      showPreferences: () => undefined,
      acceptedCategory: () => false
    };
    const service = new ConsentService();
    const script = loadWithInjectedScript(service);

    expect(service.available()).toBe(true);
    expect(script).toBeUndefined();
  });
});
