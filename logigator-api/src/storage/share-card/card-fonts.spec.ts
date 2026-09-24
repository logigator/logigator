import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { CARD_MONO, CARD_SANS, monoWidth } from './card-fonts';

/**
 * A missing typeface does not fail: fontconfig answers with whatever it has —
 * nothing at all, where the host carries no fonts — and libvips draws the card
 * in that, silently. `fonts.conf` names our four TTFs and no system directory,
 * so these two hold it to the only evidence there is: type that set, and two
 * families that are genuinely different faces.
 */
describe('the card typefaces', () => {
  async function render(family: string): Promise<Buffer> {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="80"><text x="8" y="56" font-family="${family}" font-size="42">Hamburg 018</text></svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  it('points fontconfig at the configuration beside the TTFs', () => {
    // A `FONTCONFIG_FILE` naming nothing is not an error: fontconfig falls back
    // to the system configuration, so on a machine that happens to carry fonts
    // every other test here still passes while the card ships in the wrong
    // face. The path existing is the only thing that rules that out.
    expect(existsSync(process.env['FONTCONFIG_FILE'] ?? '')).toBe(true);
  });

  it.each([CARD_SANS, CARD_MONO])('sets type in %s', async (family) => {
    const { channels } = await sharp(await render(family)).stats();

    // Ink on the transparent ground. A face fontconfig could not find leaves
    // the box empty, which is exactly what shipping the card in no type at all
    // looks like.
    expect(channels[3]?.max).toBeGreaterThan(0);
  });

  it('tells the two apart', async () => {
    const [sans, mono] = await Promise.all([
      render(CARD_SANS),
      render(CARD_MONO)
    ]);

    expect(sans.equals(mono)).toBe(false);
  });

  it('measures the mono advance the stat strip lays out by', () => {
    expect(monoWidth('184', 26)).toBeCloseTo(46.8);
    expect(monoWidth('', 26)).toBe(0);
  });
});
