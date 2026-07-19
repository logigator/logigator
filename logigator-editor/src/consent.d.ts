/**
 * Global installed by the backend-served consent bundle
 * (/js/cookieconsent.js, vanilla-cookieconsent), which `ConsentService`
 * injects at app startup. Absent when the editor runs without the backend,
 * e.g. under a bare `ng serve` — go through `ConsentService` instead of
 * reading this directly.
 */
interface Window {
  CookieConsent?: {
    showPreferences(): void;
    /** Whether the user has granted consent for the given category. */
    acceptedCategory(category: string): boolean;
  };
}
