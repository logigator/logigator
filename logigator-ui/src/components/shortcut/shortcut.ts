import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input
} from '@angular/core';

/**
 * A modifier+key combination for display. A structural subset of the editor's
 * shortcut binding, so a binding object is assignable directly; the modifiers
 * are optional and default to absent.
 */
export interface LgShortcutBinding {
  /** `KeyboardEvent.key` value, e.g. 'z', 'Escape', 'Delete'. */
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

/** Display labels for `KeyboardEvent.key` values that read poorly verbatim. */
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

const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform);

/** The display label for a single `KeyboardEvent.key` value. */
export function formatShortcutKey(key: string): string {
  return KEY_LABELS[key] ?? (key.length === 1 ? key.toUpperCase() : key);
}

function shortcutParts(binding: LgShortcutBinding, mac: boolean): string[] {
  const parts: string[] = [];
  if (mac) {
    if (binding.alt) parts.push('⌥');
    if (binding.shift) parts.push('⇧');
    if (binding.ctrl) parts.push('⌘');
  } else {
    if (binding.ctrl) parts.push('Ctrl');
    if (binding.shift) parts.push('Shift');
    if (binding.alt) parts.push('Alt');
  }
  parts.push(formatShortcutKey(binding.key));
  return parts;
}

/**
 * A shortcut as a plain string (tooltips, aria labels): `Ctrl+S`, or the mac
 * glyph run `⇧⌘Z`. `mac` defaults to the platform.
 */
export function formatShortcutLabel(
  binding: LgShortcutBinding,
  mac: boolean = IS_MAC
): string {
  return shortcutParts(binding, mac).join(mac ? '' : '+');
}

/**
 * The chips' backdrop: `content` sits on a `bg-content` surface (menus,
 * dialogs), `raised` on the elevated chrome (the tooltip bubble) — the content
 * surface in light, where the content caps apply as-is, and `surface-700` in
 * dark, where the caps go one step lighter instead.
 */
export type LgShortcutTone = 'content' | 'raised';

const KBD_TONE: Record<LgShortcutTone, string> = {
  content: 'border-border bg-content-hover text-muted',
  raised:
    'border-border bg-content-hover text-muted ' +
    'dark:border-surface-500 dark:bg-surface-600 dark:text-surface-100'
};

const JOINER_TONE: Record<LgShortcutTone, string> = {
  content: 'text-xs text-muted',
  raised: 'text-xs text-muted dark:text-surface-300'
};

/**
 * A key combination rendered as `<kbd>` chips — `Ctrl + S`, or the glyph run
 * `⇧ ⌘ Z` on mac (no separators there). A `null` binding renders an en dash,
 * the "unassigned" placeholder. `mac` defaults to the platform and exists as
 * an input for tests and previews.
 */
@Component({
  selector: 'lg-shortcut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center gap-1' },
  template: `
    @for (part of parts(); track $index) {
      <kbd [class]="kbdClass()">{{ part }}</kbd>
      @if (!mac() && !$last) {
        <span [class]="joinerClass()">+</span>
      }
    } @empty {
      <span [class]="joinerClass()">–</span>
    }
  `
})
export class LgShortcut {
  readonly binding = input.required<LgShortcutBinding | null>();
  readonly tone = input<LgShortcutTone>('content');
  readonly mac = input(IS_MAC);

  protected readonly parts = computed<string[]>(() => {
    const b = this.binding();
    return b ? shortcutParts(b, this.mac()) : [];
  });

  protected readonly kbdClass = computed(
    () =>
      `inline-block rounded border px-1 font-mono text-xs leading-normal ${KBD_TONE[this.tone()]}`
  );

  protected readonly joinerClass = computed(() => JOINER_TONE[this.tone()]);
}
