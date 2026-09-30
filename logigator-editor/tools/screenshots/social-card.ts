#!/usr/bin/env node
/**
 * Composes the site's social card: the `og:image` every page names that has
 * no card of its own, and the one the editor's own Open Graph tags name.
 *
 *   node logigator-editor/tools/screenshots/social-card.ts logigator-web
 *
 * The argument is the website's package root, as `run.ts`'s is the consuming
 * package's: the board is read from `src/assets/hero-board-dark.webp` and the
 * wordmark from `src/assets/logo-on-dark.svg`, and the card is written to
 * `public/assets/social-card.png`.
 *
 * The card is the home page's hero in the dark scheme, as a picture: the same
 * board, the same scrim fading it out under the copy, and the page ground the
 * scrim fades to. Its chrome — the green edge along the top, the domain along
 * the bottom, the ground itself — is the API's composed share card's, so a
 * pasted link to the site and one to a document look like one product. The
 * board is the capture the site already ships rather than a drawing, so a
 * re-shot hero is a re-run of this script away from the card.
 *
 * PNG, the one image the tool writes that is not WebP: an `og:image` is read
 * by link unfurlers rather than browsers, several of which read no WebP, and
 * nothing negotiates a format with them.
 *
 * Nothing on it is translated: Open Graph carries no language, and the URL is
 * the same for every page in every one.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);

/**
 * The API's share card carries the TTFs and the `fonts.conf` that make
 * sharp's own fontconfig find them. A face it cannot find is substituted
 * without an error, so the card borrows those rather than trusting the host.
 * Assigned before anything reaches libvips: fontconfig reads it once.
 */
process.env['FONTCONFIG_FILE'] = path.join(
  REPO_ROOT,
  'logigator-api/src/storage/share-card/fonts/fonts.conf'
);

const WIDTH = 1200;
const HEIGHT = 630;

/** The dark scheme's values, as `logigator-api`'s `card-layout.ts` has them. */
const COLORS = {
  /** `--lg-surface-950`: the page the hero's scrim fades to. */
  ground: '#09090b',
  primary: '#27ae60',
  ink: '#ffffff',
  inkFaint: '#71717a'
} as const;

/**
 * How the board is cut out of the hero render. `zoom` is on top of covering
 * the card, and `focusX`/`focusY` place the crop the way `object-position`
 * does, `0` pinning the render's left or top edge and `1` its right or bottom.
 * The home page draws it with `scale-115` at `68% 50%`.
 */
const BOARD = { zoom: 1.04, focusX: 0.9, focusY: 0.5 } as const;

/**
 * The home page's wide scrim, as offsets across the card and the ground's
 * opacity there. Opaque under the copy, clear by the right edge.
 */
const SCRIM: readonly (readonly [offset: number, opacity: number])[] = [
  [0, 1],
  [0.4, 1],
  [0.56, 0.6],
  [0.74, 0.14],
  [0.88, 0]
];

/** The API card's green rule along the top edge. */
const EDGE_HEIGHT = 6;

/** Left edge of everything set on the card, the API card's margin. */
const MARGIN_X = 64;

const WORDMARK = { y: 104, height: 52 } as const;

/**
 * The line, broken by hand: SVG has no wrapping. A segment with `accent` is
 * set in the primary green.
 */
const HEADLINE = {
  lines: [
    [{ text: 'Build & simulate' }],
    [{ text: 'logic circuits', accent: true }, { text: ' online,' }],
    [{ text: 'for free' }]
  ],
  size: 60,
  firstBaseline: 262,
  lineHeight: 72,
  tracking: -1
} as const satisfies {
  lines: readonly (readonly { text: string; accent?: boolean }[])[];
  size: number;
  firstBaseline: number;
  lineHeight: number;
  tracking: number;
};

const DOMAIN = {
  text: 'logigator.com',
  baseline: 567,
  size: 20,
  tracking: 0.5
} as const;

async function main(): Promise<void> {
  const webRoot = process.argv[2];
  if (!webRoot) {
    console.error('usage: social-card.ts <logigator-web root>');
    process.exit(2);
  }

  const assets = path.join(webRoot, 'src/assets');
  const out = path.join(webRoot, 'public/assets/social-card.png');

  const [board, wordmark] = await Promise.all([
    boardLayer(path.join(assets, 'hero-board-dark.webp')),
    wordmarkLayer(path.join(assets, 'logo-on-dark.svg'))
  ]);

  const png = await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 4,
      background: COLORS.ground
    }
  })
    .composite([
      { input: board, left: 0, top: 0 },
      { input: Buffer.from(overlay()), left: 0, top: 0 },
      { input: wordmark, left: MARGIN_X, top: WORDMARK.y }
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, png);
  console.log(`wrote ${out} (${(png.length / 1024).toFixed(0)} kB)`);
}

/** The hero render, covering the card at `BOARD`'s zoom and focus. */
async function boardLayer(file: string): Promise<Buffer> {
  const source = sharp(file);
  const { width = 0, height = 0 } = await source.metadata();
  const scale = Math.max(WIDTH / width, HEIGHT / height) * BOARD.zoom;
  const scaledWidth = Math.round(width * scale);
  const scaledHeight = Math.round(height * scale);

  return source
    .resize(scaledWidth, scaledHeight, { kernel: 'lanczos3' })
    .extract({
      left: Math.round((scaledWidth - WIDTH) * BOARD.focusX),
      top: Math.round((scaledHeight - HEIGHT) * BOARD.focusY),
      width: WIDTH,
      height: HEIGHT
    })
    .png()
    .toBuffer();
}

/** The wordmark, rasterized at the height it is set at. */
async function wordmarkLayer(file: string): Promise<Buffer> {
  return sharp(await fs.readFile(file), { density: 600 })
    .resize({ height: WORDMARK.height, kernel: 'lanczos3' })
    .png()
    .toBuffer();
}

/** Scrim, edge and type, as one SVG over the board. */
function overlay(): string {
  const stops = SCRIM.map(
    ([offset, opacity]) =>
      `<stop offset="${offset}" stop-color="${COLORS.ground}" stop-opacity="${opacity}"/>`
  ).join('');

  const headline = HEADLINE.lines
    .map((line, index) => {
      const spans = line
        .map(
          (segment) =>
            `<tspan fill="${'accent' in segment ? COLORS.primary : COLORS.ink}">${escapeXml(segment.text)}</tspan>`
        )
        .join('');
      const y = HEADLINE.firstBaseline + index * HEADLINE.lineHeight;
      return `<text x="${MARGIN_X}" y="${y}" font-family="Roboto" font-weight="700" font-size="${HEADLINE.size}" letter-spacing="${HEADLINE.tracking}" xml:space="preserve">${spans}</text>`;
    })
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">` +
    `<defs><linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0">${stops}</linearGradient></defs>` +
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#scrim)"/>` +
    `<rect width="${WIDTH}" height="${EDGE_HEIGHT}" fill="${COLORS.primary}"/>` +
    headline +
    `<text x="${MARGIN_X}" y="${DOMAIN.baseline}" font-family="Roboto Mono" font-size="${DOMAIN.size}" letter-spacing="${DOMAIN.tracking}" fill="${COLORS.inkFaint}">${escapeXml(DOMAIN.text)}</text>` +
    `</svg>`
  );
}

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

await main();
