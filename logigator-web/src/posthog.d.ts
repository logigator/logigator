/**
 * The global the consent-gated PostHog snippet installs (see
 * `public/js/posthog-init.js`). It is absent until the visitor grants the
 * `analytics` category — and forever if they decline — so every call site
 * treats it as optional rather than gating on consent itself.
 */
interface Window {
  posthog?: {
    capture(event: string, properties?: Record<string, unknown>): void;
  };
}
