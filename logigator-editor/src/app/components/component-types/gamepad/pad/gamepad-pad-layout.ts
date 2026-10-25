import { GAMEPAD_DEFAULT_LABELS, GamepadControlId } from '@logigator/core';

/**
 * The controller drawing's coordinate system. Every number below is in these
 * units: the SVG draws in them through its `viewBox`, and the HTML laid over
 * it converts them to percentages of the same box, so both scale together.
 */
export const PAD_VIEWBOX = { width: 480, height: 248 } as const;

/** A control's body as the SVG draws it. */
export type PadShape =
  | {
      readonly kind: 'disc';
      readonly cx: number;
      readonly cy: number;
      readonly r: number;
    }
  | {
      readonly kind: 'rect';
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly radius: number;
    };

/** What a control carries on its face: a letter, or a Phosphor icon. */
export type PadGlyph =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'icon'; readonly icon: string };

export interface PadPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Where a control's name goes: a slot `width` wide whose `align` edge (or
 * centre) sits at `x`, vertically centred on `y`.
 */
export interface PadCaptionSlot extends PadPoint {
  readonly width: number;
  readonly align: 'start' | 'center' | 'end';
}

export interface PadControlLayout {
  readonly control: GamepadControlId;
  readonly shape: PadShape;
  readonly glyph: PadGlyph;
  /** The glyph's centre. */
  readonly glyphAt: PadPoint;
  /** The glyph's font size. */
  readonly glyphSize: number;
  readonly caption: PadCaptionSlot;
  /** The keycap chip's centre. */
  readonly chip: PadPoint;
  /** Extra hit area around the shape on every side when enlarged. */
  readonly slop: number;
}

/** The D-pad as one hit region: a centre and the reach of its arms. */
export interface PadDpad {
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  readonly slop: number;
}

export interface PadLayout {
  /** The present controls, in the order they were asked for. */
  readonly controls: readonly PadControlLayout[];
  readonly dpad: PadDpad;
}

/** A plain box in viewBox units. */
export interface PadBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The controller's body: a stadium, drawn whatever the pad's controls. */
export const PAD_BODY = {
  x: 8,
  y: 44,
  width: 464,
  height: 196,
  radius: 98
} as const;

const DPAD_CENTRE = { x: 106, y: 142 } as const;
/** Half an arm's width. */
const DPAD_HALF = 18;
/** Centre to an arm's outer end. */
const DPAD_REACH = 54;

export const PAD_DPAD: PadDpad = {
  cx: DPAD_CENTRE.x,
  cy: DPAD_CENTRE.y,
  radius: DPAD_REACH,
  slop: 6
};

/** The D-pad cross as one outline, the arms' union. */
export const PAD_DPAD_CROSS_PATH = ((): string => {
  const { x: cx, y: cy } = DPAD_CENTRE;
  const h = DPAD_HALF;
  const r = DPAD_REACH;
  return (
    `M${cx - h} ${cy - r}H${cx + h}V${cy - h}H${cx + r}V${cy + h}` +
    `H${cx + h}V${cy + r}H${cx - h}V${cy + h}H${cx - r}V${cy - h}` +
    `H${cx - h}Z`
  );
})();

/** One D-pad arm, from the centre outwards along `(ux, uy)`. */
function dpadArm(
  control: GamepadControlId,
  ux: number,
  uy: number,
  icon: string,
  caption: PadCaptionSlot
): PadControlLayout {
  const { x: cx, y: cy } = DPAD_CENTRE;
  const mid = (DPAD_HALF + DPAD_REACH) / 2;
  const length = DPAD_REACH - DPAD_HALF;
  const across = 2 * DPAD_HALF;
  const width = ux !== 0 ? length : across;
  const height = uy !== 0 ? length : across;
  const glyphAt = { x: cx + ux * mid, y: cy + uy * mid };
  return {
    control,
    shape: {
      kind: 'rect',
      x: glyphAt.x - width / 2,
      y: glyphAt.y - height / 2,
      width,
      height,
      radius: 4
    },
    glyph: { kind: 'icon', icon },
    glyphAt,
    glyphSize: 22,
    caption,
    chip: {
      x: cx + ux * (DPAD_REACH + 12),
      y: cy + uy * (DPAD_REACH + 12)
    },
    slop: 0
  };
}

/**
 * Each arm's name sits in the corner of the cross clockwise from it, so the
 * four never share a corner.
 */
const DPAD: Readonly<
  Record<'up' | 'down' | 'left' | 'right', PadControlLayout>
> = {
  up: dpadArm('up', 0, -1, 'ph ph-caret-up', {
    x: 128,
    y: 106,
    width: 40,
    align: 'start'
  }),
  right: dpadArm('right', 1, 0, 'ph ph-caret-right', {
    x: 128,
    y: 178,
    width: 40,
    align: 'start'
  }),
  down: dpadArm('down', 0, 1, 'ph ph-caret-down', {
    x: 84,
    y: 178,
    width: 40,
    align: 'end'
  }),
  left: dpadArm('left', -1, 0, 'ph ph-caret-left', {
    x: 84,
    y: 106,
    width: 40,
    align: 'end'
  })
};

/**
 * A face button: a disc with its letter, its name under it and the keycap
 * chip on its lower-right edge.
 */
function faceButton(
  control: GamepadControlId,
  cx: number,
  cy: number,
  r: number
): PadControlLayout {
  const corner = r * 0.75;
  return {
    control,
    shape: { kind: 'disc', cx, cy, r },
    glyph: { kind: 'text', text: GAMEPAD_DEFAULT_LABELS[control] },
    glyphAt: { x: cx, y: cy },
    glyphSize: 16,
    caption: { x: cx, y: cy + r + 10, width: 44, align: 'center' },
    chip: { x: cx + corner, y: cy + corner },
    slop: 6
  };
}

const FACE_CENTRE = { x: 374, y: 142 } as const;

/**
 * Face buttons by how many the pad has: a diamond (X top, Y left, A right,
 * B bottom), the NES diagonal (B lower left, A upper right) or one centred A.
 */
function faceLayouts(
  count: number
): Partial<Record<GamepadControlId, PadControlLayout>> {
  const { x, y } = FACE_CENTRE;
  if (count >= 4) {
    const d = 46;
    return {
      x: faceButton('x', x, y - d, 20),
      y: faceButton('y', x - d, y, 20),
      a: faceButton('a', x + d, y, 20),
      b: faceButton('b', x, y + d, 20)
    };
  }
  if (count === 2) {
    return {
      a: faceButton('a', x + 24, y - 20, 22),
      b: faceButton('b', x - 24, y + 20, 22)
    };
  }
  return { a: faceButton('a', x, y, 24) };
}

/**
 * A shoulder bumper above the body: the letter at its outer end, the name in
 * the rest of the bar, the chip beyond the outer end.
 */
function shoulder(control: 'l' | 'r', x: number): PadControlLayout {
  const width = 120;
  const y = 8;
  const height = 28;
  const mid = y + height / 2;
  const outerLeft = control === 'l';
  return {
    control,
    shape: { kind: 'rect', x, y, width, height, radius: 12 },
    glyph: { kind: 'text', text: GAMEPAD_DEFAULT_LABELS[control] },
    glyphAt: { x: outerLeft ? x + 16 : x + width - 16, y: mid },
    glyphSize: 14,
    caption: outerLeft
      ? { x: x + 32, y: mid, width: width - 40, align: 'start' }
      : { x: x + width - 32, y: mid, width: width - 40, align: 'end' },
    chip: { x: outerLeft ? x - 14 : x + width + 14, y: mid },
    slop: 6
  };
}

const SHOULDERS: Readonly<Record<'l' | 'r', PadControlLayout>> = {
  l: shoulder('l', 52),
  r: shoulder('r', 308)
};

/** A menu pill in the middle of the body: chip above, name below. */
function menuPill(control: 'select' | 'start', cx: number): PadControlLayout {
  const width = 36;
  const height = 16;
  const cy = 150;
  return {
    control,
    shape: {
      kind: 'rect',
      x: cx - width / 2,
      y: cy - height / 2,
      width,
      height,
      radius: height / 2
    },
    glyph: { kind: 'text', text: GAMEPAD_DEFAULT_LABELS[control] },
    glyphAt: { x: cx, y: cy },
    glyphSize: 9,
    caption: { x: cx, y: cy + 22, width: 44, align: 'center' },
    chip: { x: cx, y: cy - 20 },
    slop: 5
  };
}

const MENU_CENTRE_X = 240;

function menuLayouts(
  count: number
): Partial<Record<GamepadControlId, PadControlLayout>> {
  if (count >= 2) {
    return {
      select: menuPill('select', MENU_CENTRE_X - 24),
      start: menuPill('start', MENU_CENTRE_X + 24)
    };
  }
  return { start: menuPill('start', MENU_CENTRE_X) };
}

const FACE: ReadonlySet<GamepadControlId> = new Set(['a', 'b', 'x', 'y']);
const MENU: ReadonlySet<GamepadControlId> = new Set(['select', 'start']);

/**
 * Where each of `controls` sits on the fixed silhouette. The D-pad and the
 * shoulders have one place each; the face and menu groups arrange by how
 * many of their buttons are present. A control not in `controls` is not
 * drawn.
 */
export function padLayout(controls: readonly GamepadControlId[]): PadLayout {
  const faces = faceLayouts(controls.filter((c) => FACE.has(c)).length);
  const menus = menuLayouts(controls.filter((c) => MENU.has(c)).length);
  const table: Partial<Record<GamepadControlId, PadControlLayout>> = {
    ...DPAD,
    ...faces,
    ...SHOULDERS,
    ...menus
  };
  return {
    controls: controls.flatMap((control) => table[control] ?? []),
    dpad: PAD_DPAD
  };
}

/** The box a shape covers, grown by `grow` on every side. */
export function shapeBox(shape: PadShape, grow = 0): PadBox {
  return shape.kind === 'disc'
    ? {
        x: shape.cx - shape.r - grow,
        y: shape.cy - shape.r - grow,
        width: 2 * (shape.r + grow),
        height: 2 * (shape.r + grow)
      }
    : {
        x: shape.x - grow,
        y: shape.y - grow,
        width: shape.width + 2 * grow,
        height: shape.height + 2 * grow
      };
}

/** The D-pad's hit region: the cross's square, grown by `grow`. */
export function dpadBox(dpad: PadDpad, grow = 0): PadBox {
  const reach = dpad.radius + grow;
  return {
    x: dpad.cx - reach,
    y: dpad.cy - reach,
    width: 2 * reach,
    height: 2 * reach
  };
}
