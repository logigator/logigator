import type { Locale } from '../common/locale';
import { MAIL_STRINGS, type MailStrings } from './mail-strings';

/** A rendered mail, both parts. */
export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

export type MailKind = keyof (typeof MAIL_STRINGS)['en'];

export interface MailParams {
  username: string;
  /** The absolute URL the mail asks the recipient to open. */
  link: string;
  /** Site root, for the logo and the imprint link. */
  publicUrl: string;
}

/** Escapes text interpolated into the HTML part; `username` is user-chosen. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders one of the API's mails in the recipient's language. A function
 * returning a string rather than a template engine with a view directory, for
 * three mails. Both parts are produced, because a mail with no text alternative
 * is a deliverability problem, and the markup is table-based with inline
 * styles, which is what mail clients render predictably.
 */
export function renderMail(
  kind: MailKind,
  locale: Locale,
  params: MailParams
): RenderedMail {
  const strings: MailStrings = MAIL_STRINGS[locale][kind];
  const username = escapeHtml(params.username);
  // Escaped for the attribute it lands in, not URI-encoded: the caller already
  // encoded the token, and encoding again turns its `%2F` into `%252F`.
  const link = escapeHtml(params.link);

  // Escaped as collected, so the one paragraph carrying markup is the only one
  // built out of markup.
  const paragraphs: string[] = [];
  if (strings.note !== undefined) paragraphs.push(escapeHtml(strings.note));
  paragraphs.push(
    `${escapeHtml(strings.callToAction)} <a href="${link}" style="color:#1f8b4c">${escapeHtml(strings.linkLabel)}</a>.`
  );
  paragraphs.push(escapeHtml(strings.closing));

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(strings.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;color:#222">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff">
<tr><td align="center" style="background:#27ae60;padding:20px">
<a href="${escapeHtml(params.publicUrl)}"><img src="${escapeHtml(params.publicUrl)}/assets/logo.png" alt="Logigator" height="72" style="border:0;outline:none;display:block"></a>
</td></tr>
<tr><td style="padding:24px">
<p style="font-size:20px;margin:0 0 16px 0">Hi ${username}! ${escapeHtml(strings.intro)}</p>
${paragraphs.map((paragraph) => `<p style="font-size:16px;line-height:24px;margin:0 0 16px 0">${paragraph}</p>`).join('\n')}
</td></tr>
<tr><td align="center" style="background:#27ae60;padding:16px">
<a href="${escapeHtml(params.publicUrl)}/imprint" style="color:#0b3d20;font-size:14px">Imprint</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    `Hi ${params.username}! ${strings.intro}`,
    strings.note,
    `${strings.callToAction}: ${params.link}`,
    strings.closing
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n\n');

  return { subject: strings.subject, html, text };
}
