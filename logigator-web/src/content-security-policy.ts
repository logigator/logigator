import { environment } from './environments/environment';
import { homeVideo, videoEmbedUrl } from './app/pages/home/home-video';

/**
 * Report-only until the reports from production are clean; the header name is
 * the one switch to enforcing.
 */
export const CONTENT_SECURITY_POLICY_HEADER =
  'Content-Security-Policy-Report-Only';

/** Where browsers send violation reports, as `report-uri` names it. */
const CSP_REPORT_URL = `${environment.apiUrl}/api/csp-report`;

/** The Reporting API group `report-to` names. */
const CSP_REPORT_GROUP = 'csp';

/**
 * The `Reporting-Endpoints` value that defines the group, for a page served
 * from `origin`: the Reporting API takes an absolute URL only.
 */
export function reportingEndpoints(origin: string): string {
  return `${CSP_REPORT_GROUP}="${new URL(CSP_REPORT_URL, origin).href}"`;
}

/** What `server.ts` hands a render as its `REQUEST_CONTEXT`. */
export interface RenderContext {
  cspNonce: string;
}

/** The nonce a render was handed, or `null` outside a request. */
export function cspNonceOf(context: unknown): string | null {
  const nonce = (context as Partial<RenderContext> | null)?.cspNonce;
  return typeof nonce === 'string' ? nonce : null;
}

/**
 * Hands a render's document its nonce before the app renders into it. The
 * template's own scripts take it directly, event replay's contract among them;
 * the critical-CSS step reads it off the root element's `ngCspNonce`, and puts
 * a script carrying it in place of the stylesheet's `onload` handler.
 */
export function stampCspNonce(document: Document, nonce: string): void {
  for (const script of document.querySelectorAll('script:not([nonce])')) {
    script.setAttribute('nonce', nonce);
  }
  document.querySelector('web-root')?.setAttribute('ngCspNonce', nonce);
}

/** 128 random bits, base64: a fresh one per response. */
export function createCspNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/**
 * The site's policy for one rendered page.
 *
 * Reports go to `report-uri`, and to the `report-to` group where the response
 * defines it with {@link reportingEndpoints}: a browser that reads `report-to`
 * ignores `report-uri`, so naming a group the response leaves undefined would
 * silence it.
 *
 * Scripts are the bundle, PostHog's own lazily loaded scripts and the inline
 * ones the render stamps with `nonce`: event replay's contract and the loader
 * that swaps in the full stylesheet. No `'strict-dynamic'`, so the host list
 * stays in force. Styles keep `'unsafe-inline'`: components set `style`
 * attributes at runtime, and a nonce beside it would switch it off.
 */
export function siteContentSecurityPolicy(
  nonce: string,
  { reportTo }: { reportTo: boolean }
): string {
  const posthog = new URL(environment.analytics.posthogHost).origin;
  const video = new URL(videoEmbedUrl(homeVideo('en'))).origin;

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' ${posthog}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${posthog}`,
    `frame-src ${video}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    `report-uri ${CSP_REPORT_URL}`,
    ...(reportTo ? [`report-to ${CSP_REPORT_GROUP}`] : [])
  ].join('; ');
}
