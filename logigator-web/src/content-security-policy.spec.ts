import { describe, expect, it } from 'vitest';
import { environment } from './environments/environment';
import { homeVideo, videoEmbedUrl } from './app/pages/home/home-video';
import {
  createCspNonce,
  reportingEndpoints,
  siteContentSecurityPolicy,
  stampCspNonce
} from './content-security-policy';

function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split(';').map((directive) => {
      const [name, ...sources] = directive.trim().split(/\s+/);
      return [name as string, sources];
    })
  );
}

describe('siteContentSecurityPolicy', () => {
  const nonce = createCspNonce();
  const policy = directives(
    siteContentSecurityPolicy(nonce, { reportTo: true })
  );

  it('runs inline script only by the nonce of this response', () => {
    const scripts = policy.get('script-src');
    expect(scripts).toContain(`'nonce-${nonce}'`);
    expect(scripts).not.toContain("'unsafe-inline'");
    // It would make the host list below it ignored.
    expect(scripts).not.toContain("'strict-dynamic'");
  });

  it('keeps inline styles allowed, which a nonce beside them would switch off', () => {
    const styles = policy.get('style-src');
    expect(styles).toContain("'unsafe-inline'");
    expect(styles?.some((source) => source.startsWith("'nonce-"))).toBe(false);
  });

  it('lets PostHog load its scripts and send its events', () => {
    const posthog = new URL(environment.analytics.posthogHost).origin;
    expect(policy.get('script-src')).toContain(posthog);
    expect(policy.get('connect-src')).toContain(posthog);
  });

  it('frames the video the home page embeds', () => {
    for (const lang of ['en', 'de'] as const) {
      const embed = new URL(videoEmbedUrl(homeVideo(lang))).origin;
      expect(policy.get('frame-src')).toContain(embed);
    }
  });

  it('is framed by this origin only', () => {
    expect(policy.get('frame-ancestors')).toEqual(["'self'"]);
  });

  it('reports to the endpoint the Reporting-Endpoints group names', () => {
    const origin = 'https://logigator.test';
    const [reportUri] = policy.get('report-uri') ?? [];
    const [group] = policy.get('report-to') ?? [];

    expect(reportingEndpoints(origin)).toBe(
      `${group}="${new URL(reportUri ?? '', origin).href}"`
    );
  });

  // A browser that reads `report-to` ignores `report-uri`, so a group the
  // response does not define would leave it reporting nowhere.
  it('names no group where the response defines none', () => {
    const unvouched = directives(
      siteContentSecurityPolicy(nonce, { reportTo: false })
    );

    expect(unvouched.has('report-to')).toBe(false);
    expect(unvouched.get('report-uri')).toEqual(policy.get('report-uri'));
  });
});

describe('createCspNonce', () => {
  it('answers 128 bits, different each time', () => {
    const first = createCspNonce();
    expect(atob(first)).toHaveLength(16);
    expect(createCspNonce()).not.toBe(first);
  });
});

describe('stampCspNonce', () => {
  /**
   * The build writes event replay's contract into the template as a plain
   * inline script, and the critical-CSS step finds the nonce nowhere but on
   * the root element; either one missing blocks a script once the policy
   * is enforced.
   */
  it('hands the nonce to the template scripts and to the root element', () => {
    const page = document.implementation.createHTMLDocument();
    page.body.innerHTML =
      '<script id="ng-event-dispatch-contract">void 0</script><web-root></web-root>';

    stampCspNonce(page, 'abc');

    expect(
      page.getElementById('ng-event-dispatch-contract')?.getAttribute('nonce')
    ).toBe('abc');
    expect(page.querySelector('web-root')?.getAttribute('ngCspNonce')).toBe(
      'abc'
    );
  });
});
