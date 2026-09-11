import sharp from 'sharp';
import { CARD_MONO, CARD_SANS, monoWidth } from './card-fonts';
import { ICONS, WORDMARK, WORDMARK_VIEWBOX, type CardIcon } from './card-art';
import {
  AVATAR,
  CARD_HEIGHT,
  CARD_WIDTH,
  COLORS,
  DOMAIN,
  DOT_OPACITY,
  EDGE_HEIGHT,
  LATTICE_PITCH,
  NAME,
  PANEL,
  PICTURE,
  STATS,
  SYMBOL,
  USERNAME,
  WORDMARK as WORDMARK_BOX
} from './card-layout';

/** What a share card says about a board. */
export interface ProjectSubject {
  readonly kind: 'project';
  readonly componentCount: number;
  readonly wireCount: number;
  /**
   * The stored dark render, as it lies on the volume, or `null` where the
   * document has none. A render that turns out to be nothing but transparency
   * counts as none: the plate degrades to bare lattice either way.
   */
  readonly render: Buffer | null;
}

/**
 * What a share card says about a library component. It carries no render — the
 * panel draws the symbol, which is what a placed instance of it looks like.
 */
export interface ComponentSubject {
  readonly kind: 'component';
  readonly symbol: string;
  readonly numInputs: number;
  readonly numOutputs: number;
  readonly labels: readonly string[];
}

export type ShareCardSubject = ProjectSubject | ComponentSubject;

export interface ShareCardInput {
  readonly name: string;
  readonly username: string;
  /** The stored 64px WebP avatar, or `null` for the initials fallback. */
  readonly avatar: Buffer | null;
  readonly stars: number;
  /** The host the card is composed for, as chrome along the bottom edge. */
  readonly host: string;
  readonly subject: ShareCardSubject;
}

/** Transparent, for a trim that has to tell content from padding. */
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/**
 * Draws one 1200×630 card.
 *
 * The whole plate is a single SVG that libvips rasterizes once, rather than a
 * chain of composites: `preserveAspectRatio` *is* contain-fitting, a `clipPath`
 * *is* the avatar's circle mask, and a `pattern` *is* the lattice, so the parts
 * that would be raw-buffer arithmetic are declarations instead. Only the two
 * photographs are prepared beforehand, and only because sharp resamples them
 * better than librsvg would.
 */
export async function composeShareCard(card: ShareCardInput): Promise<Buffer> {
  const [picture, avatar] = await Promise.all([
    card.subject.kind === 'project'
      ? preparePicture(card.subject.render)
      : null,
    prepareAvatar(card.avatar)
  ]);

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">`,
    defs(avatar !== null),
    ground(),
    wordmark(),
    name(card.name),
    author(card.username, avatar),
    stats(card),
    domain(card.host),
    card.subject.kind === 'project'
      ? panel(picture)
      : symbolPanel(card.subject),
    `</svg>`
  ].join('');

  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

/** One prepared raster, at the size it is placed. */
interface Raster {
  readonly png: Buffer;
  readonly width: number;
  readonly height: number;
}

/**
 * The stored render, trimmed and fitted to the picture area.
 *
 * Trimming first is what keeps the circuit from shrinking twice: the stored
 * square is already contain-fit content inside transparent bars, so fitting
 * *that* into a landscape frame would fit the bars. A render that is nothing
 * but bars answers `null` — detected by asking whether any pixel is opaque at
 * all, since a full-bleed circuit trims to its own dimensions just as an empty
 * one does.
 */
async function preparePicture(render: Buffer | null): Promise<Raster | null> {
  if (!render) return null;

  try {
    const { channels } = await sharp(render).stats();
    const alpha = channels[3];
    if (alpha && alpha.max === 0) return null;

    const { data, info } = await sharp(render)
      .trim({ background: TRANSPARENT, threshold: 0 })
      .resize(PICTURE.size, PICTURE.size, { fit: 'inside' })
      .png({ compressionLevel: 9 })
      .toBuffer({ resolveWithObject: true });

    return { png: data, width: info.width, height: info.height };
  } catch {
    // A render this server wrote that no longer decodes is the same situation
    // as one that was never uploaded, and a card is not the place to find out.
    return null;
  }
}

/** The stored avatar at the size it is drawn, as PNG: librsvg reads no WebP. */
async function prepareAvatar(avatar: Buffer | null): Promise<Raster | null> {
  if (!avatar) return null;

  try {
    const png = await sharp(avatar)
      .resize(AVATAR.size, AVATAR.size, { fit: 'cover' })
      .png({ compressionLevel: 9 })
      .toBuffer();

    return { png, width: AVATAR.size, height: AVATAR.size };
  } catch {
    return null;
  }
}

function defs(hasAvatar: boolean): string {
  const avatarClip = hasAvatar
    ? `<clipPath id="avatar"><circle cx="${AVATAR.x + AVATAR.size / 2}" cy="${AVATAR.y + AVATAR.size / 2}" r="${AVATAR.size / 2}"/></clipPath>`
    : '';

  return (
    `<defs>` +
    `<pattern id="lattice" width="${LATTICE_PITCH}" height="${LATTICE_PITCH}" patternUnits="userSpaceOnUse">` +
    `<circle cx="1" cy="1" r="1" fill="${COLORS.dot}" fill-opacity="${DOT_OPACITY}"/>` +
    `</pattern>` +
    `<clipPath id="name"><rect x="${NAME.x}" y="${NAME.y}" width="${NAME.width}" height="${NAME.height}"/></clipPath>` +
    avatarClip +
    `</defs>`
  );
}

/**
 * The editor's own ground, which is the one choice that makes a pasted link
 * look like a screenshot of a tool rather than a floating schematic.
 */
function ground(): string {
  return (
    `<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${COLORS.ground}"/>` +
    `<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#lattice)"/>` +
    `<rect width="${CARD_WIDTH}" height="${EDGE_HEIGHT}" fill="${COLORS.primary}"/>`
  );
}

function wordmark(): string {
  const scale = WORDMARK_BOX.height / WORDMARK_VIEWBOX.height;
  return `<g transform="translate(${WORDMARK_BOX.x} ${WORDMARK_BOX.y}) scale(${scale})">${WORDMARK}</g>`;
}

function name(value: string): string {
  return (
    `<g clip-path="url(#name)">` +
    text(value, {
      x: NAME.x,
      y: NAME.baseline,
      family: CARD_SANS,
      size: NAME.size,
      weight: 700,
      fill: COLORS.ink,
      tracking: NAME.tracking
    }) +
    `</g>`
  );
}

function author(username: string, avatar: Raster | null): string {
  const center = AVATAR.x + AVATAR.size / 2;
  const face = avatar
    ? `<image href="${dataUri(avatar.png)}" x="${AVATAR.x}" y="${AVATAR.y}" width="${AVATAR.size}" height="${AVATAR.size}" clip-path="url(#avatar)"/>`
    : // The site's own fallback: the first two characters of the name, since
      // `avatarId` is nullable and the default avatar is a site asset rather
      // than a stored one.
      `<circle cx="${center}" cy="${AVATAR.y + AVATAR.size / 2}" r="${AVATAR.size / 2}" fill="${COLORS.symbolBody}"/>` +
      text(username.slice(0, 2).toUpperCase(), {
        x: center,
        y: AVATAR.y + AVATAR.size / 2 + AVATAR.initialsSize * 0.35,
        family: CARD_MONO,
        size: AVATAR.initialsSize,
        weight: 500,
        fill: COLORS.inkSoft,
        anchor: 'middle'
      });

  return (
    face +
    `<circle cx="${center}" cy="${AVATAR.y + AVATAR.size / 2}" r="${AVATAR.size / 2}" fill="none" stroke="${COLORS.panelBorder}"/>` +
    text(username, {
      x: USERNAME.x,
      y: USERNAME.baseline,
      family: CARD_SANS,
      size: USERNAME.size,
      fill: COLORS.inkSoft
    })
  );
}

/**
 * Three figures, whichever three the subject is counted by. Laid out by
 * arithmetic over the mono advance: there is no flow in an SVG, and the
 * numbers are the one thing on the card whose width is knowable.
 */
function stats(card: ShareCardInput): string {
  const groups: [CardIcon, number][] =
    card.subject.kind === 'project'
      ? [
          ['components', card.subject.componentCount],
          ['wires', card.subject.wireCount],
          ['stars', card.stars]
        ]
      : [
          ['inputs', card.subject.numInputs],
          ['outputs', card.subject.numOutputs],
          ['stars', card.stars]
        ];

  let x = STATS.x;
  return groups
    .map(([icon, value]) => {
      // Plain digits in every language: a grouped or abbreviated figure is a
      // locale decision, and one card answers four of them.
      const figure = String(value);
      const scale = STATS.iconSize / 24;
      const group =
        `<g transform="translate(${x} ${STATS.y + (STATS.height - STATS.iconSize) / 2}) scale(${scale})">${ICONS[icon]}</g>` +
        text(figure, {
          x: x + STATS.iconSize + STATS.iconGap,
          y: STATS.baseline,
          family: CARD_MONO,
          size: STATS.size,
          weight: 500,
          fill: COLORS.ink
        });

      x +=
        STATS.iconSize +
        STATS.iconGap +
        monoWidth(figure, STATS.size) +
        STATS.groupGap;
      return group;
    })
    .join('');
}

function domain(host: string): string {
  return text(host, {
    x: DOMAIN.x,
    y: DOMAIN.baseline,
    family: CARD_MONO,
    size: DOMAIN.size,
    fill: COLORS.inkFaint,
    tracking: DOMAIN.tracking
  });
}

/**
 * The picture, or the frame with nothing in it. A missing render keeps the
 * panel rather than falling back to the site's generic card: the name, the
 * author and the counts still carry the link, and throwing all of that away is
 * the worse outcome.
 */
function panel(picture: Raster | null): string {
  const frame =
    `<rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.size}" height="${PANEL.size}" fill="${COLORS.panel}"/>` +
    (picture
      ? ''
      : `<rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.size}" height="${PANEL.size}" fill="url(#lattice)"/>`) +
    `<rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.size}" height="${PANEL.size}" fill="none" stroke="${COLORS.panelBorder}"/>`;

  if (!picture) return frame;

  // Already fitted, so it is placed at its own size rather than fitted again.
  const x = PICTURE.x + (PICTURE.size - picture.width) / 2;
  const y = PICTURE.y + (PICTURE.size - picture.height) / 2;
  return (
    frame +
    `<image href="${dataUri(picture.png)}" x="${x}" y="${y}" width="${picture.width}" height="${picture.height}"/>`
  );
}

/** The component's symbol, drawn the way the editor draws a placed instance. */
function symbolPanel(subject: ComponentSubject): string {
  const frame =
    `<rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.size}" height="${PANEL.size}" fill="${COLORS.panel}"/>` +
    `<rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.size}" height="${PANEL.size}" fill="none" stroke="${COLORS.panelBorder}"/>`;

  const ports = symbolPorts(subject);
  const spread = Math.max(subject.numInputs, subject.numOutputs, 1) - 1;
  const bodyHeight = ports.length
    ? Math.max(
        SYMBOL.minBodyHeight,
        spread * SYMBOL.portPitch + 2 * SYMBOL.bodyMargin
      )
    : SYMBOL.minBodyHeight;
  const bodyLeft = SYMBOL.centerX - SYMBOL.bodyWidth / 2;
  const bodyRight = bodyLeft + SYMBOL.bodyWidth;

  // Stubs first, then the body over them, then the labels on top of it: the
  // body is opaque, and a label reads from inside it.
  const art =
    ports
      .map(
        (port) =>
          `<path d="M${port.input ? bodyLeft - SYMBOL.stubLength : bodyRight} ${port.y}h${SYMBOL.stubLength}" stroke="${COLORS.inkSoft}" stroke-width="2" fill="none"/>`
      )
      .join('') +
    `<rect x="${bodyLeft}" y="${SYMBOL.centerY - bodyHeight / 2}" width="${SYMBOL.bodyWidth}" height="${bodyHeight}" fill="${COLORS.symbolBody}" stroke="${COLORS.primary}" stroke-width="2.5"/>` +
    ports
      .filter((port) => port.label)
      .map((port) =>
        text(port.label, {
          x: port.input
            ? bodyLeft + SYMBOL.labelInset
            : bodyRight - SYMBOL.labelInset,
          y: port.y + 6,
          family: CARD_MONO,
          size: SYMBOL.labelSize,
          fill: COLORS.inkSoft,
          anchor: port.input ? 'start' : 'end'
        })
      )
      .join('') +
    text(subject.symbol, {
      x: SYMBOL.centerX,
      y: SYMBOL.centerY + 10,
      family: CARD_MONO,
      size: SYMBOL.textSize,
      weight: 500,
      fill: COLORS.ink,
      anchor: 'middle'
    });

  return frame + `<g transform="translate(${SYMBOL.x} ${SYMBOL.y})">${art}</g>`;
}

/** One drawn port, in the symbol art's own space. */
interface SymbolPort {
  readonly input: boolean;
  readonly y: number;
  readonly label: string;
}

/**
 * Where the stubs go, or none at all. Past `maxDrawnPorts` the pitch would
 * outgrow the panel, so a wide component draws as a bare body and the stat
 * strip is what carries its arity.
 *
 * `labels` is inputs first, then outputs, in plug-index order — how a master's
 * ports are extracted — so a label lands beside the port it names.
 */
function symbolPorts(subject: ComponentSubject): SymbolPort[] {
  if (
    subject.numInputs > SYMBOL.maxDrawnPorts ||
    subject.numOutputs > SYMBOL.maxDrawnPorts
  ) {
    return [];
  }

  return [
    ...side(subject.numInputs, true, 0),
    ...side(subject.numOutputs, false, subject.numInputs)
  ];

  function side(count: number, input: boolean, offset: number): SymbolPort[] {
    return Array.from({ length: count }, (_, index) => ({
      input,
      y: SYMBOL.centerY + (index - (count - 1) / 2) * SYMBOL.portPitch,
      label: (subject.labels[offset + index] ?? '')
        .trim()
        .slice(0, SYMBOL.maxLabelChars)
    }));
  }
}

interface TextStyle {
  readonly x: number;
  readonly y: number;
  readonly family: string;
  readonly size: number;
  readonly weight?: number;
  readonly fill: string;
  readonly tracking?: number;
  readonly anchor?: 'start' | 'middle' | 'end';
}

function text(value: string, style: TextStyle): string {
  const attributes = [
    `x="${style.x}"`,
    `y="${style.y}"`,
    `font-family="${style.family}"`,
    `font-size="${style.size}"`,
    style.weight ? `font-weight="${style.weight}"` : '',
    style.tracking ? `letter-spacing="${style.tracking}"` : '',
    style.anchor ? `text-anchor="${style.anchor}"` : '',
    `fill="${style.fill}"`
  ].filter(Boolean);

  return `<text ${attributes.join(' ')}>${escapeXml(value)}</text>`;
}

function dataUri(png: Buffer): string {
  return `data:image/png;base64,${png.toString('base64')}`;
}

/**
 * Every string on the card is somebody's document name, username, symbol or
 * port label, and all of it goes into a document this server then parses. An
 * unescaped `<` would be markup of the author's choosing inside our own
 * renderer; a control character would make libxml2 reject the whole card,
 * turning one hostile name into an endpoint that answers nothing.
 */
function escapeXml(value: string): string {
  return (
    value
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  );
}
