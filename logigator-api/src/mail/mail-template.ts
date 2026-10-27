import type { Locale } from '../common/locale';
import { MAIL_STRINGS } from './mail-strings';

/** A rendered mail, both parts. */
export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

export type MailKind = keyof (typeof MAIL_STRINGS)['en']['mails'];

export interface MailParams {
  username: string;
  /** The absolute URL the mail asks the recipient to open. */
  link: string;
  /** How long {@link link} works, stated in the footnote. */
  linkLifetimeMinutes: number;
  /** Site root, for the logo and the footer links. */
  publicUrl: string;
  /**
   * What the wording's other placeholders stand for, `{name}` and `{reason}`
   * of the moderation mails. Plain text, escaped where it lands like the
   * username: a document's name is its author's and a reason a moderator's.
   */
  values?: Record<string, string>;
}

/**
 * The site's `--lg-*` theme values, light and dark. A mail cannot read the
 * site's stylesheet, so the colors are copied by value from
 * `logigator-ui/styles/theme.css`.
 */
const LIGHT = {
  bar: '#27ae60', // primary-400, the site's top bar in both schemes
  page: '#f1f5f9', // surface-100
  card: '#ffffff', // content
  border: '#e2e8f0', // surface-200
  heading: '#1e293b', // text-hover
  text: '#334155', // text
  muted: '#64748b', // muted
  button: '#209150', // primary
  buttonText: '#ffffff' // primary-contrast
} as const;

const DARK = {
  page: '#09090b', // surface-950
  card: '#18181b', // content
  border: '#3f3f46', // border
  heading: '#ffffff',
  text: '#e4e4e7', // surface-200
  muted: '#a1a1aa', // muted
  button: '#27ae60', // primary
  buttonText: '#18181b' // primary-contrast
} as const;

const FONT =
  "Roboto,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/** Escapes text interpolated into the HTML part; `username` is user-chosen. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Replaces each `{name}` in a string with its value. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? values[name] : match
  );
}

/** "1 hour", "90 Minuten": whole hours when the lifetime is one. */
function formatLifetime(minutes: number, locale: Locale): string {
  const inHours = minutes % 60 === 0;
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: inHours ? 'hour' : 'minute',
    unitDisplay: 'long'
  }).format(inHours ? minutes / 60 : minutes);
}

/**
 * Renders one of the API's mails in the recipient's language, shaped like the
 * site: its green bar with the wordmark, then one card on a slate page.
 *
 * Both parts are produced, because a mail with no text alternative is a
 * deliverability problem. The markup is tables with inline styles, which is
 * what mail clients render predictably; the `<style>` block only adds what an
 * inline style cannot say (dark mode, narrow screens), and a client that drops
 * it still gets the light layout. The logo is a PNG under the site's
 * `public/`, since several clients render no SVG and a mail keeps its URL for
 * as long as it sits in an inbox; `/assets/logo.png` is also the address every
 * older Logigator mail names.
 */
export function renderMail(
  kind: MailKind,
  locale: Locale,
  params: MailParams
): RenderedMail {
  const { common, mails } = MAIL_STRINGS[locale];
  const strings = mails[kind];
  const greeting = fill(common.greeting, { username: params.username });
  const values = params.values ?? {};
  // Filled before escaping, in one pass, so a value is never read for
  // placeholders of its own.
  const body = strings.body.map((text) => fill(text, values));
  const footnote = fill(strings.footnote, {
    ...values,
    duration: formatLifetime(params.linkLifetimeMinutes, locale)
  });
  const site = `${params.publicUrl}/${locale}`;

  // Escaped for the attribute it lands in, not URI-encoded: the caller already
  // encoded the token, and encoding again turns its `%2F` into `%252F`.
  const link = escapeHtml(params.link);
  const publicUrl = escapeHtml(params.publicUrl);
  const paragraph = `margin:0 0 16px 0;font-size:16px;line-height:24px;color:${LIGHT.text}`;
  const small = `margin:0;font-size:14px;line-height:20px;color:${LIGHT.muted}`;

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(strings.subject)}</title>
<style>
@media (max-width: 600px) {
  .lg-card-cell { padding: 24px 20px !important; }
}
@media (prefers-color-scheme: dark) {
  .lg-page { background: ${DARK.page} !important; }
  .lg-card { background: ${DARK.card} !important; border-color: ${DARK.border} !important; }
  .lg-heading { color: ${DARK.heading} !important; }
  .lg-text { color: ${DARK.text} !important; }
  .lg-muted, .lg-muted a { color: ${DARK.muted} !important; }
  .lg-rule { border-color: ${DARK.border} !important; }
  .lg-button { background: ${DARK.button} !important; }
  .lg-button a { color: ${DARK.buttonText} !important; }
  .lg-link { color: ${DARK.button} !important; }
}
</style>
</head>
<body class="lg-page" style="margin:0;padding:0;background:${LIGHT.page};font-family:${FONT}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(body[0])}</div>
<table role="presentation" class="lg-page" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${LIGHT.page}">
<tr><td align="center" style="background:${LIGHT.bar};padding:12px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px">
<tr><td>
<a href="${escapeHtml(site)}"><img src="${publicUrl}/assets/logo.png" alt="Logigator" width="145" height="32" style="display:block;border:0;outline:none;width:145px;height:32px"></a>
</td></tr>
</table>
</td></tr>
<tr><td align="center" style="padding:32px 16px 24px 16px">
<table role="presentation" class="lg-card" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:${LIGHT.card};border:1px solid ${LIGHT.border};border-radius:12px;border-collapse:separate">
<tr><td class="lg-card-cell" style="padding:32px;font-family:${FONT}">
<h1 class="lg-heading" style="margin:0 0 20px 0;font-size:22px;line-height:30px;font-weight:500;color:${LIGHT.heading}">${escapeHtml(strings.heading)}</h1>
<p class="lg-text" style="${paragraph}">${escapeHtml(greeting)}</p>
${body.map((text) => `<p class="lg-text" style="${paragraph}">${escapeHtml(text)}</p>`).join('\n')}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0">
<tr><td class="lg-button" style="background:${LIGHT.button};border-radius:6px">
<a href="${link}" style="display:inline-block;padding:12px 20px;font-family:${FONT};font-size:16px;line-height:24px;font-weight:500;color:${LIGHT.buttonText};text-decoration:none;border-radius:6px">${escapeHtml(strings.button)}</a>
</td></tr>
</table>
<p class="lg-muted" style="${small};margin-bottom:4px">${escapeHtml(common.fallback)}</p>
<p style="${small};word-break:break-all"><a class="lg-link" href="${link}" style="color:${LIGHT.button}">${link}</a></p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px">
<tr><td class="lg-rule" style="border-top:1px solid ${LIGHT.border};padding-top:20px">
<p class="lg-muted" style="${small}">${escapeHtml(footnote)}</p>
</td></tr>
</table>
</td></tr>
</table>
</td></tr>
<tr><td align="center" style="padding:0 16px 32px 16px">
<p class="lg-muted" style="${small};font-family:${FONT}">
<a href="${escapeHtml(site)}/imprint" style="color:${LIGHT.muted};text-decoration:underline">${escapeHtml(common.imprint)}</a>
&nbsp;&middot;&nbsp;
<a href="${escapeHtml(site)}/privacy-policy" style="color:${LIGHT.muted};text-decoration:underline">${escapeHtml(common.privacyPolicy)}</a>
</p>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    strings.heading,
    greeting,
    ...body,
    `${strings.button}: ${params.link}`,
    footnote,
    `${common.imprint}: ${site}/imprint\n${common.privacyPolicy}: ${site}/privacy-policy`
  ].join('\n\n');

  return { subject: strings.subject, html, text };
}
