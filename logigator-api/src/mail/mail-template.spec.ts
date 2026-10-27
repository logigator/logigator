import { describe, expect, it } from 'vitest';
import { LOCALES } from '../common/locale';
import { MAIL_STRINGS } from './mail-strings';
import { renderMail, type MailKind } from './mail-template';

const KINDS: MailKind[] = [
  'verifyRegistration',
  'verifyEmailChange',
  'resetPassword',
  'documentHidden',
  'documentHiddenAutomatically',
  'documentUnhidden'
];

const params = {
  username: 'Ada',
  link: 'https://logigator.test/verify-email/abc123',
  linkLifetimeMinutes: 60,
  publicUrl: 'https://logigator.test',
  values: { name: 'Half Adder', reason: 'Spam' }
};

describe('renderMail', () => {
  it('escapes the username in the HTML part', () => {
    const mail = renderMail('verifyRegistration', 'en', {
      ...params,
      username: '<script>alert(1)</script>'
    });

    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });

  it('escapes a document name and a reason in the HTML part', () => {
    const mail = renderMail('documentHidden', 'en', {
      ...params,
      values: { name: '<img src=x onerror=alert(1)>', reason: '"<b>bold</b>"' }
    });

    expect(mail.html).not.toContain('<img src=x');
    expect(mail.html).not.toContain('<b>bold</b>');
    expect(mail.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    // The text part is plain text, so the name reaches it as written.
    expect(mail.text).toContain('<img src=x onerror=alert(1)>');
  });

  it('takes a value as text, never as more placeholders', () => {
    const mail = renderMail('documentHidden', 'en', {
      ...params,
      values: { name: '{reason}', reason: 'Spam' }
    });

    expect(mail.text).toContain('“{reason}”');
  });

  it.each(KINDS)('puts the link in both parts of a %s mail', (kind) => {
    const mail = renderMail(kind, 'en', params);

    expect(mail.html).toContain(`href="${params.link}"`);
    // A client that renders only text has no other way to reach the flow.
    expect(mail.text).toContain(params.link);
  });

  it('leaves an already-encoded token in the link untouched', () => {
    const link = 'https://logigator.test/reset-password?token=a%2Fb';
    const mail = renderMail('resetPassword', 'en', { ...params, link });

    expect(mail.html).toContain(`href="${link}"`);
  });

  it.each(LOCALES)('renders every mail in %s with no gaps', (locale) => {
    for (const kind of KINDS) {
      const mail = renderMail(kind, locale, params);
      const strings = MAIL_STRINGS[locale].mails[kind];

      expect(mail.subject).toBe(strings.subject);
      for (const part of [mail.html, mail.text]) {
        expect(part).not.toContain('undefined');
        // A placeholder left in the wording would reach the recipient as is.
        expect(part).not.toMatch(/\{\w+\}/);
        expect(part).toContain(strings.button);
      }
    }
  });

  it('states the link lifetime in the recipient language', () => {
    const german = renderMail('resetPassword', 'de', params);
    const french = renderMail('verifyRegistration', 'fr', {
      ...params,
      linkLifetimeMinutes: 90
    });

    expect(german.text).toContain('1 Stunde gültig');
    expect(french.text).toContain('valable 90 minutes');
  });

  it('renders the requested language, not the default one', () => {
    const german = renderMail('resetPassword', 'de', params);

    expect(german.subject).toBe('Passwort zurücksetzen');
    expect(german.html).toContain('lang="de"');
  });
});
