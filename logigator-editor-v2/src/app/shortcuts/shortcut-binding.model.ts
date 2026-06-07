import { ShortcutActionEnum } from './shortcut-action.enum';

export interface ShortcutBinding {
  /** KeyboardEvent.key value, e.g. 'z', 'Escape', 'Delete'. */
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
}

export const DEFAULT_SHORTCUTS: Record<ShortcutActionEnum, ShortcutBinding> = {
  [ShortcutActionEnum.SAVE]: { key: 's', ctrl: true, shift: false, alt: false },
  [ShortcutActionEnum.OPEN]: { key: 'o', ctrl: true, shift: false, alt: false },
  [ShortcutActionEnum.NEW_COMPONENT]: {
    key: 'n',
    ctrl: true,
    shift: false,
    alt: false
  },
  [ShortcutActionEnum.UNDO]: { key: 'z', ctrl: true, shift: false, alt: false },
  [ShortcutActionEnum.REDO]: { key: 'z', ctrl: true, shift: true, alt: false },
  [ShortcutActionEnum.COPY]: { key: 'c', ctrl: true, shift: false, alt: false },
  [ShortcutActionEnum.CUT]: { key: 'x', ctrl: true, shift: false, alt: false },
  [ShortcutActionEnum.PASTE]: {
    key: 'v',
    ctrl: true,
    shift: false,
    alt: false
  },
  [ShortcutActionEnum.DELETE]: {
    key: 'Delete',
    ctrl: false,
    shift: false,
    alt: false
  },
  [ShortcutActionEnum.ZOOM_IN]: {
    key: '=',
    ctrl: true,
    shift: false,
    alt: false
  },
  [ShortcutActionEnum.ZOOM_OUT]: {
    key: '-',
    ctrl: true,
    shift: false,
    alt: false
  },
  [ShortcutActionEnum.TOOL_WIRE_DRAWING]: {
    key: 'd',
    ctrl: false,
    shift: false,
    alt: false
  },
  [ShortcutActionEnum.TOOL_WIRE_CONNECTION]: {
    key: 'c',
    ctrl: false,
    shift: false,
    alt: false
  },
  [ShortcutActionEnum.TOOL_SELECT]: {
    key: 's',
    ctrl: false,
    shift: false,
    alt: false
  },
  [ShortcutActionEnum.TOOL_SELECT_EXACT]: {
    key: 'x',
    ctrl: false,
    shift: false,
    alt: false
  },
  [ShortcutActionEnum.TOOL_ERASE]: {
    key: 'e',
    ctrl: false,
    shift: false,
    alt: false
  },
  [ShortcutActionEnum.TOOL_COMPONENT_PLACEMENT]: {
    key: 'p',
    ctrl: false,
    shift: false,
    alt: false
  },
  [ShortcutActionEnum.TOOL_PLACE_TEXT]: {
    key: 't',
    ctrl: false,
    shift: false,
    alt: false
  },
  [ShortcutActionEnum.CANCEL]: {
    key: 'Escape',
    ctrl: false,
    shift: false,
    alt: false
  }
};

const KEY_LABELS: Readonly<Record<string, string>> = {
  Escape: 'Esc',
  Delete: 'Del',
  Backspace: '⌫',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  ' ': 'Space'
};

export function formatKey(key: string): string {
  return KEY_LABELS[key] ?? (key.length === 1 ? key.toUpperCase() : key);
}

export function formatShortcutLabel(
  binding: ShortcutBinding,
  isMac: boolean
): string {
  const parts: string[] = [];
  if (isMac) {
    if (binding.alt) parts.push('⌥');
    if (binding.shift) parts.push('⇧');
    if (binding.ctrl) parts.push('⌘');
  } else {
    if (binding.ctrl) parts.push('Ctrl');
    if (binding.shift) parts.push('Shift');
    if (binding.alt) parts.push('Alt');
  }
  parts.push(formatKey(binding.key));
  return isMac ? parts.join('') : parts.join('+');
}
