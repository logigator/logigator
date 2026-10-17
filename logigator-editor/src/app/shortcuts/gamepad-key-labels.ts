/**
 * Fixed keycap labels by `KeyboardEvent.code`, for the codes whose label does
 * not follow from the code's own spelling. Letters and digits are derived in
 * {@link fixedKeyLabel}; a code in neither falls back to itself.
 */
const FIXED_LABELS: Readonly<Record<string, string>> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Enter: '↵',
  NumpadEnter: 'Num ↵',
  Space: 'Space',
  Backspace: '⌫',
  Delete: 'Del',
  Insert: 'Ins',
  Home: 'Home',
  End: 'End',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
  CapsLock: '⇪',
  ShiftLeft: '⇧',
  ShiftRight: '⇧R',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl R',
  AltLeft: 'Alt',
  AltRight: 'Alt R',
  MetaLeft: 'Meta',
  MetaRight: 'Meta R',
  ContextMenu: 'Menu',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Comma: ',',
  Period: '.',
  Slash: '/',
  NumpadAdd: 'Num +',
  NumpadSubtract: 'Num -',
  NumpadMultiply: 'Num *',
  NumpadDivide: 'Num /',
  NumpadDecimal: 'Num .'
};

/**
 * Phosphor icon classes for the codes a keycap draws as an icon rather than
 * as text. Each has a text label as well, for aria labels and tooltips.
 */
const KEY_ICONS: Readonly<Record<string, string>> = {
  ArrowUp: 'ph ph-arrow-up',
  ArrowDown: 'ph ph-arrow-down',
  ArrowLeft: 'ph ph-arrow-left',
  ArrowRight: 'ph ph-arrow-right',
  Enter: 'ph ph-arrow-elbow-down-left'
};

/**
 * A code's keycap label in the US layout: `KeyA` → `A`, `Digit1` → `1`,
 * `Numpad1` → `Num 1`, `ArrowUp` → `↑`, `ShiftRight` → `⇧R`. A code with no
 * entry is its own label.
 */
export function fixedKeyLabel(code: string): string {
  const fixed = FIXED_LABELS[code];
  if (fixed !== undefined) return fixed;
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return letter[1];
  const digit = /^Digit(\d)$/.exec(code);
  if (digit) return digit[1];
  const numpad = /^Numpad(\d)$/.exec(code);
  if (numpad) return `Num ${numpad[1]}`;
  return code;
}

/** The Phosphor icon class a keycap draws for `code`, or `null` for text. */
export function keyIcon(code: string): string | null {
  return KEY_ICONS[code] ?? null;
}

/**
 * The character a layout map reports for a key, as a keycap shows it:
 * upper-cased where that stays one character (`ß` would become `SS`).
 */
export function layoutKeyLabel(character: string): string {
  const upper = character.toLocaleUpperCase();
  return [...upper].length === 1 ? upper : character;
}
