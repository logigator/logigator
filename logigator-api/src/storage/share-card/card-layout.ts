/**
 * The card's geometry, in card pixels at its fixed 1200×630. Every number here
 * is read off the plates in `plans/artifacts/share-card.html`, so this file and
 * that document are the two halves of one table.
 *
 * Nothing is derived from the viewer: Open Graph negotiates no colour scheme
 * and carries no language, so the card is dark, and everything on it is either
 * a figure or a name the document itself supplies.
 */

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

/**
 * Bumped whenever a plate changes shape. It is part of what the `ETag` hashes,
 * so a redesign invalidates the cards a client already holds — without it a
 * conditional request answers `304` against the old drawing forever.
 */
export const CARD_LAYOUT_VERSION = 1;

/**
 * The dark scheme's own values rather than tokens: `@logigator/ui` publishes
 * them as CSS variables, which is a form nothing server-side can read, and the
 * card is a picture of the product rather than a page of it.
 */
export const COLORS = {
  ground: '#09090b',
  dot: '#3f3f46',
  primary: '#27ae60',
  ink: '#ffffff',
  inkSoft: '#a1a1aa',
  inkFaint: '#71717a',
  inkFaintest: '#52525b',
  panel: '#18181b',
  panelBorder: '#3f3f46',
  symbolBody: '#27272a'
} as const;

/** The editor's ground: a 1px dot on a 16px lattice. */
export const LATTICE_PITCH = 16;
export const DOT_OPACITY = 0.85;

/** The site's green bar, reduced to a rule along the top edge. */
export const EDGE_HEIGHT = 6;

/**
 * Everything that has to survive sits inside this inset: Twitter crops a
 * `summary_large_image` to a 2:1 band and LinkedIn to about 1.91:1, so only the
 * ground and the primary edge are allowed outside it.
 */
export const SAFE_INSET = 32;

export const WORDMARK = { x: 64, y: 52, height: 34 } as const;

/**
 * The name, clipped to its box rather than shortened: the proportional face
 * gives no advance to measure against, and a name cut mid-glyph is a better
 * failure than one that runs into the picture.
 */
export const NAME = {
  x: 64,
  y: 132,
  width: 640,
  height: 68,
  size: 56,
  tracking: -1,
  baseline: 185
} as const;

export const AVATAR = { x: 64, y: 246, size: 48, initialsSize: 19 } as const;

export const USERNAME = { x: 124, size: 28, baseline: 280 } as const;

/**
 * The stat strip: an icon, then the figure in the mono face, then the next
 * group. It sells depth in a way a picture of three rectangles does not, which
 * is why the figures are large enough to read in a feed.
 */
export const STATS = {
  x: 64,
  y: 338,
  height: 32,
  iconSize: 26,
  iconGap: 10,
  groupGap: 36,
  size: 26,
  baseline: 363
} as const;

/** The origin the card was composed by, as chrome rather than a link. */
export const DOMAIN = {
  x: 64,
  baseline: 567,
  size: 20,
  tracking: 0.5
} as const;

/**
 * The picture, on an opaque fill: a preview is line art on a transparent
 * ground, and a share surface composites that over whatever it likes — white
 * on some, black on others — so the card has to bring its own ground with it.
 */
export const PANEL = {
  x: 736,
  y: 115,
  size: 400,
  inset: 24,
  noteBaseline: 483,
  noteSize: 17
} as const;

/** Where the render sits once it has been trimmed and contain-fitted. */
export const PICTURE = {
  x: PANEL.x + PANEL.inset,
  y: PANEL.y + PANEL.inset,
  size: PANEL.size - 2 * PANEL.inset
} as const;

/**
 * A library component's panel draws its symbol instead of its circuit: the
 * symbol and the arity are what a placed instance shows, and they are the two
 * facts somebody deciding whether to clone it is after.
 *
 * The art has a 300×200 space of its own, centred in the panel, so the plate's
 * numbers are the ones in the artifact's own symbol drawing.
 */
export const SYMBOL = {
  x: PANEL.x + 50,
  y: PANEL.y + 100,
  width: 300,
  height: 200,
  /** Half the art box, where the body is centred. */
  centerX: 150,
  centerY: 100,
  bodyWidth: 172,
  /** The body never draws smaller than the three-port plate. */
  minBodyHeight: 132,
  /** Above the first port and below the last. */
  bodyMargin: 26,
  portPitch: 40,
  stubLength: 50,
  labelInset: 12,
  labelSize: 17,
  textSize: 42,
  /**
   * Ports past this many are not drawn at all — the pitch would outgrow the
   * panel, and the stat strip already carries the arity.
   */
  maxDrawnPorts: 5,
  /** What fits beside a stub at the label size, in mono glyphs. */
  maxLabelChars: 8
} as const;
