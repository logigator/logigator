/**
 * Global installed by the consent bundle `index.html` loads. Absent until that
 * script runs — and under a bare `ng serve` for good — so every reader treats
 * it as optional.
 */
interface Window {
  CookieConsent?: {
    showPreferences(): void;
    /** Whether the user has granted consent for the given category. */
    acceptedCategory(category: string): boolean;
  };
}
