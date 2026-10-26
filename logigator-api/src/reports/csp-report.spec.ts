import { describe, expect, it } from 'vitest';
import {
  browserOf,
  cspViolationsFrom,
  MAX_REPORTS_PER_REQUEST,
  reducedUrl
} from './csp-report';

const CHROME =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

const NONCE = 'q7VbX1n0kz3T2mR9yW4hLg==';

function reportUri(report: Record<string, unknown>) {
  return { 'csp-report': report };
}

function reportingApi(body: Record<string, unknown>, type = 'csp-violation') {
  return {
    type,
    age: 12,
    url: 'https://logigator.com/en/',
    user_agent: CHROME,
    body
  };
}

describe('cspViolationsFrom', () => {
  it('reads both formats to the same violation', () => {
    const fromReportUri = cspViolationsFrom(
      reportUri({
        'document-uri': 'https://logigator.com/en/docs?x=1',
        'effective-directive': 'script-src-elem',
        'violated-directive': 'script-src-elem',
        'blocked-uri': 'inline',
        'source-file': 'https://logigator.com/main-ABCD1234.js',
        'line-number': 3,
        'column-number': 1207,
        disposition: 'report',
        'original-policy': `script-src 'nonce-${NONCE}'`,
        'script-sample': 'alert(document.cookie)'
      }),
      CHROME
    );
    const fromReportingApi = cspViolationsFrom(
      [
        reportingApi({
          documentURL: 'https://logigator.com/en/docs#top',
          effectiveDirective: 'script-src-elem',
          blockedURL: 'inline',
          sourceFile: 'https://logigator.com/main-ABCD1234.js',
          lineNumber: 3,
          columnNumber: 1207,
          disposition: 'report',
          originalPolicy: `script-src 'nonce-${NONCE}'`,
          sample: 'alert(document.cookie)'
        })
      ],
      CHROME
    );

    expect(fromReportUri).toEqual([
      {
        directive: 'script-src-elem',
        blocked: 'inline',
        document: 'https://logigator.com/en/docs',
        source: 'https://logigator.com/main-ABCD1234.js',
        line: 3,
        column: 1207,
        disposition: 'report',
        browser: 'chrome 141'
      }
    ]);
    expect(fromReportingApi).toEqual(fromReportUri);
  });

  it('never carries the policy, its nonce or the sample', () => {
    const logged = JSON.stringify(
      cspViolationsFrom(
        reportUri({
          'violated-directive': `script-src 'self' 'nonce-${NONCE}'`,
          'blocked-uri': 'eval',
          'script-sample': 'secret page text'
        }),
        CHROME
      )
    );

    expect(logged).toContain('"directive":"script-src"');
    expect(logged).not.toContain(NONCE);
    expect(logged).not.toContain('secret page text');
  });

  it('keeps only csp-violation entries of a Reporting API batch', () => {
    const violations = cspViolationsFrom(
      [
        reportingApi({ message: 'deprecated' }, 'deprecation'),
        reportingApi({ effectiveDirective: 'img-src', blockedURL: 'data' })
      ],
      CHROME
    );

    expect(violations.map((v) => v.directive)).toEqual(['img-src']);
  });

  it(`reads at most ${MAX_REPORTS_PER_REQUEST} entries of a batch`, () => {
    const batch = Array.from({ length: 50 }, (_, line) =>
      reportingApi({ effectiveDirective: 'img-src', lineNumber: line })
    );

    expect(cspViolationsFrom(batch, CHROME)).toHaveLength(
      MAX_REPORTS_PER_REQUEST
    );
  });

  it.each([
    ['nothing', undefined],
    ['a string', 'csp-report'],
    ['an empty object', {}],
    ['a report of the wrong shape', { 'csp-report': 'script-src' }],
    ['an empty batch', []],
    ['a batch of garbage', [null, 1, 'x', { type: 'csp-violation' }]],
    ['a report with no directive', reportUri({ 'blocked-uri': 'eval' })],
    [
      'a directive that is not one',
      reportUri({ 'effective-directive': '<script>alert(1)</script>' })
    ]
  ])('finds nothing in %s', (_, body) => {
    expect(cspViolationsFrom(body, CHROME)).toEqual([]);
  });

  it('drops fields of the wrong type and keeps the rest', () => {
    const [violation] = cspViolationsFrom(
      reportUri({
        'effective-directive': 'img-src',
        'blocked-uri': 42,
        'line-number': '7',
        'column-number': -1,
        disposition: 'whatever'
      }),
      CHROME
    );

    expect(violation).toEqual({ directive: 'img-src', browser: 'chrome 141' });
  });
});

describe('reducedUrl', () => {
  it('drops the query and the fragment', () => {
    expect(
      reducedUrl('https://logigator.com/en/reset-password?token=abc#form')
    ).toBe('https://logigator.com/en/reset-password');
  });

  it.each([
    [
      'a mail token',
      'https://logigator.com/en/verify-email/0Zk3nQ-xV9_pL2mR8sT4wY6aB1cD5eF7gH0iJ2kL4mN',
      'https://logigator.com/en/verify-email/:id'
    ],
    [
      'a share link',
      'https://logigator.com/editor/share/projects/0b7e4f3c-1d2a-4e5b-8c9d-0e1f2a3b4c5d',
      'https://logigator.com/editor/share/projects/:id'
    ],
    [
      'a document link',
      'https://logigator.com/de/community/components/0b7e4f3c-1d2a-4e5b-8c9d-0e1f2a3b4c5d/stargazers',
      'https://logigator.com/de/community/components/:id/stargazers'
    ]
  ])('hides %s in the path', (_, url, reduced) => {
    expect(reducedUrl(url)).toBe(reduced);
  });

  it('keeps slugs and hashed file names readable', () => {
    expect(
      reducedUrl('https://logigator.com/en/docs/getting-started-with-wires')
    ).toBe('https://logigator.com/en/docs/getting-started-with-wires');
    expect(reducedUrl('https://logigator.com/chunk-Q2ZJ7LKM.js')).toBe(
      'https://logigator.com/chunk-Q2ZJ7LKM.js'
    );
  });

  it('keeps keywords and reduces other schemes to their name', () => {
    expect(reducedUrl('inline')).toBe('inline');
    expect(reducedUrl('wasm-eval')).toBe('wasm-eval');
    expect(reducedUrl('data:image/png;base64,iVBORw0KGgo=')).toBe('data');
    expect(reducedUrl('blob:https://logigator.com/0b7e4f3c-1d2a')).toBe('blob');
    expect(reducedUrl('chrome-extension://abcdefghijklmnop/content.js')).toBe(
      'chrome-extension'
    );
  });

  it('caps the length', () => {
    const url = `https://logigator.com/${'a/'.repeat(500)}`;
    expect(reducedUrl(url)?.length).toBe(256);
  });

  it('answers nothing for what is not a URL', () => {
    expect(reducedUrl('not a url at all')).toBeUndefined();
    expect(reducedUrl('')).toBeUndefined();
  });
});

describe('browserOf', () => {
  it.each([
    [CHROME, 'chrome 141'],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
      'edge 141'
    ],
    [
      'Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0',
      'firefox 144'
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
      'safari 18'
    ],
    ['curl/8.5.0', 'other'],
    [undefined, 'other']
  ])('names %s as %s', (agent, browser) => {
    expect(browserOf(agent)).toBe(browser);
  });
});
