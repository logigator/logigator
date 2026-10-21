import { describe, expect, it } from 'vitest';
import { checkTranslatedDescription } from './translation-check';

const ORIGINAL = [
  'A counter that wraps at `0xF`. Read [the manual](https://logigator.com/docs) first.',
  '',
  '## How to use it',
  '',
  '| Input | Effect |',
  '| ----- | ------ |',
  '| CLK   | counts |',
  '| RST   | clears |',
  '',
  '```',
  'ROM 0x00: 3F 06 5B',
  '```',
  '',
  'See https://example.com/datasheet.pdf for the part.'
].join('\n');

const FAITHFUL = [
  'Ein Zähler, der bei `0xF` überläuft. Lies zuerst [das Handbuch](https://logigator.com/docs).',
  '',
  '## Bedienung',
  '',
  '| Eingang | Wirkung  |',
  '| ------- | -------- |',
  '| CLK     | zählt    |',
  '| RST     | löscht   |',
  '',
  '```',
  'ROM 0x00: 3F 06 5B',
  '```',
  '',
  'Das Bauteil ist unter https://example.com/datasheet.pdf beschrieben.'
].join('\n');

describe('checkTranslatedDescription', () => {
  it('passes a translation that changes only the prose', () => {
    expect(checkTranslatedDescription(ORIGINAL, FAITHFUL)).toBeNull();
  });

  it('refuses altered inline code', () => {
    const altered = FAITHFUL.replace('`0xF`', '`0xE`');
    expect(checkTranslatedDescription(ORIGINAL, altered)).not.toBeNull();
  });

  it('refuses an altered code block', () => {
    const altered = FAITHFUL.replace('3F 06 5B', '3F 06 5C');
    expect(checkTranslatedDescription(ORIGINAL, altered)).not.toBeNull();
  });

  it('refuses inline code turned into prose', () => {
    const altered = FAITHFUL.replace('`0xF`', '0xF');
    expect(checkTranslatedDescription(ORIGINAL, altered)).not.toBeNull();
  });

  it('refuses a link the original does not have', () => {
    // Shown under the author's name, so a link the model was talked into
    // adding would be one the author never wrote.
    const added = `${FAITHFUL}\n\n[Mehr](https://evil.example)`;
    expect(checkTranslatedDescription(ORIGINAL, added)).not.toBeNull();

    const bare = `${FAITHFUL} https://evil.example`;
    expect(checkTranslatedDescription(ORIGINAL, bare)).not.toBeNull();
  });

  it('refuses a changed link destination', () => {
    const changed = FAITHFUL.replace(
      'https://logigator.com/docs',
      'https://logigator.com/de/docs'
    );
    expect(checkTranslatedDescription(ORIGINAL, changed)).not.toBeNull();
  });

  it('refuses links that trade places', () => {
    const original = '[a](https://a.example) and [b](https://b.example)';
    const swapped = '[b](https://b.example) und [a](https://a.example)';
    expect(checkTranslatedDescription(original, swapped)).not.toBeNull();
  });

  it('refuses an image the original does not have', () => {
    const added = `${FAITHFUL}\n\n![Bild](https://tracker.example/pixel.png)`;
    expect(checkTranslatedDescription(ORIGINAL, added)).not.toBeNull();
  });

  it('refuses a dropped table row', () => {
    const dropped = FAITHFUL.replace('| RST     | löscht   |\n', '');
    expect(checkTranslatedDescription(ORIGINAL, dropped)).not.toBeNull();
  });

  it('refuses a lost heading', () => {
    const flattened = FAITHFUL.replace('## Bedienung', 'Bedienung');
    expect(checkTranslatedDescription(ORIGINAL, flattened)).not.toBeNull();
  });

  it('refuses a translation the description column cannot hold', () => {
    const long = `${FAITHFUL}\n\n${'Sehr lange Erklärung. '.repeat(100)}`;
    expect(checkTranslatedDescription(ORIGINAL, long)).not.toBeNull();
  });

  it('measures the length after normalization', () => {
    // Invisible characters are stripped on the way into the column, so they
    // do not count against it.
    const padded = `${'​'.repeat(3000)}${FAITHFUL}`;
    expect(checkTranslatedDescription(ORIGINAL, padded)).toBeNull();
  });

  it('names the failure without quoting either text', () => {
    // The reason is logged and sent back to the model; neither may carry the
    // document's text.
    const altered = FAITHFUL.replace('`0xF`', '`SECRET`');
    const reason = checkTranslatedDescription(ORIGINAL, altered);
    expect(reason).not.toContain('SECRET');
    expect(reason).not.toContain('0xF');
  });
});
