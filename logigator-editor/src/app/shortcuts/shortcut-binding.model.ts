import { ShortcutActionEnum } from './shortcut-action.enum';

export interface ShortcutBinding {
  /** KeyboardEvent.key value, e.g. 'z', 'Escape', 'Delete'. */
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
}

/**
 * The binding flag a modifier key sets about itself. A bare-modifier binding
 * (hold-style, e.g. plain Alt) keeps its own flag `false` — the key field
 * already names it, and a `true` flag would render as "Alt + Alt" — so
 * binding matchers skip that flag's comparison for the binding's own key.
 */
export const MODIFIER_FLAG_BY_KEY: Readonly<
  Record<string, 'ctrl' | 'shift' | 'alt'>
> = {
  Control: 'ctrl',
  Meta: 'ctrl',
  Shift: 'shift',
  Alt: 'alt'
};

export const DEFAULT_SHORTCUTS: Record<ShortcutActionEnum, ShortcutBinding> = {
  [ShortcutActionEnum.SAVE]: { key: 's', ctrl: true, shift: false, alt: false },
  [ShortcutActionEnum.OPEN]: { key: 'o', ctrl: true, shift: false, alt: false },
  [ShortcutActionEnum.NEW_COMPONENT]: {
    key: 'n',
    ctrl: false,
    shift: false,
    alt: true
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
  [ShortcutActionEnum.ROTATE_SELECTION]: {
    key: 'r',
    ctrl: false,
    shift: false,
    alt: false
  },
  [ShortcutActionEnum.ROTATE_SELECTION_CCW]: {
    key: 'r',
    ctrl: false,
    shift: true,
    alt: false
  },
  [ShortcutActionEnum.MOVE_SELECTION_UP]: {
    key: 'ArrowUp',
    ctrl: false,
    shift: false,
    alt: false
  },
  [ShortcutActionEnum.MOVE_SELECTION_DOWN]: {
    key: 'ArrowDown',
    ctrl: false,
    shift: false,
    alt: false
  },
  [ShortcutActionEnum.MOVE_SELECTION_LEFT]: {
    key: 'ArrowLeft',
    ctrl: false,
    shift: false,
    alt: false
  },
  [ShortcutActionEnum.MOVE_SELECTION_RIGHT]: {
    key: 'ArrowRight',
    ctrl: false,
    shift: false,
    alt: false
  },
  [ShortcutActionEnum.ZOOM_IN]: {
    key: '+',
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
  [ShortcutActionEnum.ZOOM_100]: {
    key: '0',
    ctrl: true,
    shift: false,
    alt: false
  },
  [ShortcutActionEnum.TOOL_PAN]: {
    key: 'p',
    ctrl: false,
    shift: false,
    alt: false
  },
  [ShortcutActionEnum.TOOL_WIRE]: {
    key: 'w',
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
  [ShortcutActionEnum.SELECT_SCISSOR]: {
    key: 'Alt',
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
  [ShortcutActionEnum.TOOL_PLACE_TEXT]: {
    key: 't',
    ctrl: false,
    shift: false,
    alt: false
  },
  [ShortcutActionEnum.TOGGLE_SIMULATION]: {
    key: 'Enter',
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
