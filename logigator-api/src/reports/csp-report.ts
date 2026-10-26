import { z } from 'zod';

/**
 * One CSP violation as the log keeps it. Every field is either a URL reduced by
 * {@link reducedUrl}, matched against a fixed pattern, or a bounded integer, so
 * nothing a sender writes reaches the log verbatim. The policy itself (it holds
 * the page's nonce) and the sample (it can hold page content) are never read.
 */
export interface CspViolation {
  directive: string;
  blocked?: string;
  document?: string;
  source?: string;
  line?: number;
  column?: number;
  disposition?: 'enforce' | 'report';
  /** Family and major version, `other` when neither is recognized. */
  browser: string;
}

/** Reports read from one request; a browser batches far fewer. */
export const MAX_REPORTS_PER_REQUEST = 20;

const MAX_URL_LENGTH = 256;
const MAX_USER_AGENT_LENGTH = 512;

/** A field that is absent, of another type or too long reads as absent. */
const text = z.string().max(2048).optional().catch(undefined);
const position = z
  .number()
  .int()
  .min(0)
  .max(10_000_000)
  .optional()
  .catch(undefined);

/** `report-uri`: one report per request, keys hyphenated. */
const reportUriBody = z.object({
  'csp-report': z.object({
    'effective-directive': text,
    'violated-directive': text,
    'blocked-uri': text,
    'document-uri': text,
    'source-file': text,
    'line-number': position,
    'column-number': position,
    disposition: text
  })
});

/** One entry of a Reporting API batch, which carries other report types too. */
const reportingApiEntry = z.object({
  type: z.literal('csp-violation'),
  body: z.object({
    effectiveDirective: text,
    blockedURL: text,
    documentURL: text,
    sourceFile: text,
    lineNumber: position,
    columnNumber: position,
    disposition: text
  })
});

interface ViolationFields {
  directive: string | undefined;
  blocked: string | undefined;
  document: string | undefined;
  source: string | undefined;
  line: number | undefined;
  column: number | undefined;
  disposition: string | undefined;
}

/**
 * The violations in a request body of either format, at most
 * {@link MAX_REPORTS_PER_REQUEST}. Whatever does not read as one is skipped.
 */
export function cspViolationsFrom(
  body: unknown,
  userAgent: string | undefined
): CspViolation[] {
  const fields: ViolationFields[] = [];

  if (Array.isArray(body)) {
    for (const entry of body.slice(0, MAX_REPORTS_PER_REQUEST)) {
      const parsed = reportingApiEntry.safeParse(entry);
      if (!parsed.success) continue;
      const report = parsed.data.body;
      fields.push({
        directive: report.effectiveDirective,
        blocked: report.blockedURL,
        document: report.documentURL,
        source: report.sourceFile,
        line: report.lineNumber,
        column: report.columnNumber,
        disposition: report.disposition
      });
    }
  } else {
    const parsed = reportUriBody.safeParse(body);
    if (parsed.success) {
      const report = parsed.data['csp-report'];
      fields.push({
        // Older browsers name only the violated directive, followed by its
        // sources.
        directive:
          report['effective-directive'] ??
          report['violated-directive']?.trim().split(/\s/, 1)[0],
        blocked: report['blocked-uri'],
        document: report['document-uri'],
        source: report['source-file'],
        line: report['line-number'],
        column: report['column-number'],
        disposition: report.disposition
      });
    }
  }

  const browser = browserOf(userAgent);
  return fields.flatMap((report) => {
    const violation = normalized(report, browser);
    return violation ? [violation] : [];
  });
}

const DIRECTIVE = /^[a-z][a-z-]{0,39}$/;

/** Keys in a fixed order, so equal violations serialize equally. */
function normalized(
  report: ViolationFields,
  browser: string
): CspViolation | null {
  const directive = report.directive?.toLowerCase();
  if (!directive || !DIRECTIVE.test(directive)) return null;

  const violation: CspViolation = { directive, browser };
  const blocked = reducedUrl(report.blocked);
  if (blocked) violation.blocked = blocked;
  const document = reducedUrl(report.document);
  if (document) violation.document = document;
  const source = reducedUrl(report.source);
  if (source) violation.source = source;
  if (report.line !== undefined) violation.line = report.line;
  if (report.column !== undefined) violation.column = report.column;
  if (report.disposition === 'enforce' || report.disposition === 'report') {
    violation.disposition = report.disposition;
  }
  return violation;
}

/** `inline`, `eval`, `data`, `blob`, `wasm-eval`, …, or a bare scheme. */
const KEYWORD = /^[a-z][a-z0-9+-]{0,31}:?$/i;

const WEB_SCHEMES = new Set(['http:', 'https:', 'ws:', 'wss:']);

/**
 * A long run of URL-safe characters with a digit, a capital or an underscore
 * in it: a mail token, a share link, a document id. Slugs and hashed file
 * names (they carry a dot) stay readable.
 */
const OPAQUE_SEGMENT = /^(?=.*[0-9A-Z_])[A-Za-z0-9_-]{16,}$/;

/**
 * A web URL as its origin and path, with no query or fragment and every
 * opaque path segment replaced by `:id` — a one-shot mail token and an
 * unlisted document's link both sit in a path. A keyword stays as it is, and
 * any other URL is reduced to its scheme.
 */
export function reducedUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (KEYWORD.test(value)) return value.toLowerCase().replace(/:$/, '');

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (!WEB_SCHEMES.has(url.protocol)) return url.protocol.slice(0, -1);

  const path = url.pathname
    .split('/')
    .map((segment) => (OPAQUE_SEGMENT.test(segment) ? ':id' : segment))
    .join('/');
  return `${url.origin}${path}`.slice(0, MAX_URL_LENGTH);
}

/** Most specific first: every Chromium names Chrome, and Chrome names Safari. */
const BROWSERS: readonly (readonly [string, RegExp])[] = [
  ['edge', /\bEdg(?:e|A|iOS)?\/(\d{1,4})/],
  ['opera', /\bOPR\/(\d{1,4})/],
  ['samsung', /\bSamsungBrowser\/(\d{1,4})/],
  ['firefox', /\b(?:Firefox|FxiOS)\/(\d{1,4})/],
  ['chrome', /\b(?:Chrome|CriOS)\/(\d{1,4})/],
  ['safari', /\bVersion\/(\d{1,4}).*\bSafari\//]
];

/** The browser family and major version a user agent names, e.g. `firefox 131`. */
export function browserOf(userAgent: string | undefined): string {
  const agent = (userAgent ?? '').slice(0, MAX_USER_AGENT_LENGTH);
  for (const [family, pattern] of BROWSERS) {
    const major = pattern.exec(agent)?.[1];
    if (major) return `${family} ${major}`;
  }
  return 'other';
}
