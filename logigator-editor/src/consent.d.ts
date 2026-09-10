/**
 * Global installed by the backend-served consent bundle that `ConsentService`
 * injects at startup. Absent when the editor runs without the backend, so go
 * through `ConsentService` rather than reading this directly.
 */
interface Window {
  CookieConsent?: {
    showPreferences(): void;
    /** Whether the user has granted consent for the given category. */
    acceptedCategory(category: string): boolean;
  };
}
