import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild
} from '@angular/core';
import { DialogRef, DialogService, LgButton } from '@logigator/ui';
import { DialogId } from '../../../analytics/analytics.mapping';
import { LayoutService } from '../../../layout/layout.service';
import { TranslateDirective } from '../../../translation/translate.directive';
import { TranslationService } from '../../../translation/translation.service';
import {
  characterOfKey,
  KEYBOARD_TEXT_LIMIT,
  KeyboardText,
  readoutText,
  textToCodes
} from './ascii';
import type { KeyboardInspection } from './keyboard-inspection';
import { TypeTextDialogComponent } from './type-text-dialog.component';

/**
 * The capture field's one character. A soft keyboard often sends nothing for
 * Backspace in an empty field, so the field is never left empty.
 */
const SENTINEL = ' ';

/** How long a skipped-characters notice replaces the status line. */
const NOTICE_MS = 4000;

/** Keys whose character arrives later, through an input or composition event. */
const DEFERRED_KEYS = new Set(['Process', 'Unidentified', 'Dead']);

/** How the history strip draws a code without a glyph of its own. */
const HISTORY_CHIPS: ReadonlyMap<number, string> = new Map([
  [0x0a, '⏎'],
  [0x08, 'BS'],
  [0x09, 'TAB'],
  [0x1b, 'ESC'],
  [0x7f, 'DEL'],
  [0x20, '␣']
]);

const BACKSPACE = 0x08;
const DELETE = 0x7f;

/** One character of the history strip. */
interface HistoryChar {
  readonly id: number;
  readonly label: string;
  /** Drawn as a chip: a control code, or space. */
  readonly chip: boolean;
  /** The character of the key held on `D`. */
  readonly held: boolean;
}

/**
 * Whether a keydown is a shortcut rather than typing: Ctrl, Meta or Alt is
 * held. AltGr is not one, though a platform reports it as Ctrl+Alt: AltGr+Q
 * on a German layout types `@`.
 */
function isShortcut(e: KeyboardEvent): boolean {
  if (e.metaKey) return true;
  if (e.getModifierState('AltGraph')) return false;
  return e.ctrlKey || e.altKey;
}

/**
 * The keyboard's window. A hidden `<textarea>` over the history strip is the
 * capture field, and every key and every text it receives is handled on it:
 *
 * - `keydown` sends a press for an ASCII key and remembers it as the key on
 *   `D`. Auto-repeat is consumed and sends nothing. Ctrl, Meta and Alt
 *   combinations, Shift+Tab, arrows and F-keys pass through to the browser.
 *   A key whose character is still being composed (an IME, a dead key, a
 *   soft keyboard's `Unidentified`) passes through too: its text arrives as
 *   an input event. Escape is consumed where it lands, so it reaches neither
 *   the window nor the sheet, which would close.
 * - `keyup` of the key on `D`, matched by `code`, sends the release.
 * - `paste`, `beforeinput` and `compositionend` carry text that had no
 *   keydown of its own; it is sent as taps.
 * - Losing the focus, the window losing it, or the page being hidden
 *   releases the key on `D`.
 *
 * After every input event the field holds only its one-character sentinel.
 * Opening the view focuses it, except on a touch device in the compact
 * layout: an OS keyboard opens only for a focus inside the tap that asks for
 * it, and a focus without one would look like typing while no keyboard is
 * up. There the strip says `Tap to type` while the field lacks the focus, and
 * a tap on the strip lands on the field itself, which takes the focus inside
 * that tap. Type text… opens a dialog for a longer text, which goes out as
 * taps once sent; the dialog closes with the view.
 */
@Component({
  selector: 'app-keyboard-inspection',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LgButton, TranslateDirective],
  host: {
    class: 'flex h-full flex-col gap-2',
    '(mousedown)': 'claimFocus($event)'
  },
  template: `
    <ng-container *appTranslate="let t">
      <div
        class="relative shrink-0 rounded-md border bg-content transition-colors"
        [class]="
          focused() ? 'border-primary ring-2 ring-primary/30' : 'border-border'
        "
      >
        <div
          class="flex h-10 items-center justify-end gap-px overflow-hidden px-2 font-mono text-base"
          aria-hidden="true"
        >
          @if (tapToType()) {
            <span
              class="flex w-full items-center justify-center gap-1.5 font-sans text-sm text-muted"
            >
              <i class="ph ph-hand-tap shrink-0"></i>
              <span class="truncate">
                {{ t('components.def.KEYBOARD.window.tapToType') }}
              </span>
            </span>
          } @else {
            @for (char of strip(); track char.id) {
              <span
                class="shrink-0 rounded-sm px-px leading-6 whitespace-pre"
                [class.text-xs]="char.chip"
                [class.text-muted]="char.chip && !char.held"
                [class.bg-primary]="char.held"
                [class.text-primary-contrast]="char.held"
                >{{ char.label }}</span
              >
            }
            @if (focused()) {
              <span class="ml-px h-6 w-px shrink-0 bg-primary"></span>
            }
          }
        </div>
        <textarea
          #field
          class="absolute inset-0 size-full cursor-text resize-none overflow-hidden text-base opacity-0"
          rows="1"
          autocapitalize="off"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          [attr.aria-label]="t('components.def.KEYBOARD.window.field')"
          (keydown)="onKeyDown($event)"
          (keyup)="onKeyUp($event)"
          (paste)="onPaste($event)"
          (beforeinput)="onBeforeInput($event)"
          (input)="onInput($event)"
          (compositionend)="onCompositionEnd($event)"
          (focus)="focused.set(true)"
          (click)="placeCaret()"
          (focusout)="onFocusOut()"
        ></textarea>
      </div>

      <div class="flex shrink-0 items-baseline gap-4 text-sm">
        <span class="text-muted">
          {{ t('components.def.KEYBOARD.window.onD') }}
        </span>
        @if (onD(); as d) {
          <span class="font-mono">{{ d.char }}</span>
          <span class="font-mono text-muted">{{ d.hex }}</span>
          <span class="font-mono text-muted">{{ d.binary }}</span>
        }
      </div>

      <span class="grow"></span>

      <div class="flex shrink-0 items-center gap-2 text-sm" aria-live="polite">
        @if (notice(); as message) {
          <span class="min-w-0 truncate text-warn-text">{{ message }}</span>
        } @else if (focused()) {
          <span class="flex min-w-0 items-center gap-1.5 text-primary">
            <i class="ph ph-keyboard shrink-0" aria-hidden="true"></i>
            <span class="truncate">
              {{ t('components.def.KEYBOARD.window.typing') }}
            </span>
          </span>
        } @else if (!tapToType()) {
          <span class="min-w-0 truncate text-muted">
            {{ t('components.def.KEYBOARD.window.clickToType') }}
          </span>
        }
      </div>

      <div class="flex min-h-8.5 shrink-0 items-center gap-2 text-sm">
        <button
          lgButton
          size="sm"
          severity="secondary"
          outlined
          (onClick)="openTypeText()"
        >
          {{ t('components.def.KEYBOARD.window.typeText') }}
        </button>
        <span class="grow"></span>
        @if (pending() > 0) {
          <span class="text-muted">
            {{
              t('components.def.KEYBOARD.window.sending', { count: pending() })
            }}
          </span>
          <button
            lgButton
            size="sm"
            severity="secondary"
            text
            icon="ph ph-x"
            [ariaLabel]="t('components.def.KEYBOARD.window.cancelSending')"
            (onClick)="cancel()"
          ></button>
        }
      </div>
    </ng-container>
  `
})
export class KeyboardInspectionComponent {
  public readonly inspection = input.required<KeyboardInspection>();

  private readonly translation = inject(TranslationService);
  private readonly dialogs = inject(DialogService);
  private readonly layout = inject(LayoutService);
  private readonly field =
    viewChild.required<ElementRef<HTMLTextAreaElement>>('field');

  /** Whether the capture field has the focus, which is when keys are typed. */
  protected readonly focused = signal(false);
  /**
   * Whether the field takes the focus only from a tap on it: a touch device
   * in the compact layout, where that tap is what opens the OS keyboard.
   */
  private readonly focusByTap = computed(
    () => this.layout.isCompact() && this.layout.isTouch()
  );
  /** Whether the strip asks for the tap that focuses the field. */
  protected readonly tapToType = computed(
    () => this.focusByTap() && !this.focused()
  );
  /** A skipped-characters notice, shown in place of the status for a while. */
  protected readonly notice = signal<string | null>(null);
  private noticeTimer: ReturnType<typeof setTimeout> | undefined;
  private typeTextRef: DialogRef<
    readonly number[],
    TypeTextDialogComponent
  > | null = null;

  protected readonly pending = computed(() => this.inspection().pending());

  protected readonly strip = computed<readonly HistoryChar[]>(() => {
    const inspection = this.inspection();
    const held = inspection.heldEntry();
    return inspection.history().map(({ id, code }) => {
      const chip = HISTORY_CHIPS.get(code);
      return {
        id,
        label: chip ?? String.fromCharCode(code),
        chip: chip !== undefined,
        held: id === held
      };
    });
  });

  /** The code on `D` as character, hex and 7-bit binary; `null` at zero. */
  protected readonly onD = computed(() => {
    const code = this.inspection().code();
    if (code === 0) return null;
    const text = readoutText(code);
    const binary = code.toString(2).padStart(7, '0');
    return {
      char: code > 0x20 && code < 0x7f ? `'${text}'` : text,
      hex: '0x' + code.toString(16).toUpperCase().padStart(2, '0'),
      binary: `${binary.slice(0, 3)} ${binary.slice(3)}`
    };
  });

  constructor() {
    const listeners = new AbortController();
    window.addEventListener('blur', () => this.inspection().releaseHeld(), {
      signal: listeners.signal
    });
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.visibilityState === 'hidden') {
          this.inspection().releaseHeld();
        }
      },
      { signal: listeners.signal }
    );

    afterNextRender(() => {
      const field = this.field().nativeElement;
      this.restoreSentinel();
      if (!this.focusByTap()) field.focus({ preventScroll: true });
      this.focused.set(document.activeElement === field);
    });

    inject(DestroyRef).onDestroy(() => {
      listeners.abort();
      clearTimeout(this.noticeTimer);
      this.typeTextRef?.close();
      // The view can go while the inspection stays (a breakpoint flip moves
      // it to another frame); no keyup can reach this view any more.
      this.inspection().releaseHeld();
    });
  }

  /**
   * A press anywhere in the view outside a control types into the field, and
   * keeps the focus where it already was if that is the field. On touch, the
   * mousedown a tap produces arrives inside that tap, so the focus it gives
   * opens the OS keyboard; a tap on the strip lands on the field itself and
   * passes through to the browser's own focus.
   */
  protected claimFocus(e: MouseEvent): void {
    const field = this.field().nativeElement;
    const target = e.target instanceof Element ? e.target : null;
    if (target === field || target?.closest('button, a, input, select')) {
      return;
    }
    e.preventDefault();
    field.focus({ preventScroll: true });
  }

  protected onKeyDown(e: KeyboardEvent): void {
    if (e.isComposing || DEFERRED_KEYS.has(e.key)) return;
    if (e.repeat) {
      e.preventDefault();
      return;
    }
    if (isShortcut(e)) return;
    if (e.key === 'Tab' && e.shiftKey) return;
    const character = characterOfKey(e.key);
    if (!character) return;

    e.preventDefault();
    if (e.key === 'Escape') e.stopPropagation();
    if (character.kind === 'ascii') {
      this.inspection().press(e.code, character.code);
    } else {
      this.showSkipped([character.char], false);
    }
  }

  protected onKeyUp(e: KeyboardEvent): void {
    this.inspection().release(e.code);
  }

  protected onPaste(e: ClipboardEvent): void {
    const data = e.clipboardData;
    // Without clipboard data the text arrives as `insertFromPaste`.
    if (!data) return;
    e.preventDefault();
    this.typeText(data.getData('text/plain'));
  }

  protected onBeforeInput(e: InputEvent): void {
    switch (e.inputType) {
      case 'insertText':
        this.consume(e);
        this.typeText(e.data ?? '');
        return;
      case 'insertFromPaste':
        this.consume(e);
        this.typeText(e.data ?? e.dataTransfer?.getData('text/plain') ?? '');
        return;
      case 'insertLineBreak':
        this.consume(e);
        this.typeText('\n');
        return;
      case 'deleteContentBackward':
        this.consume(e);
        this.inspection().type([BACKSPACE]);
        return;
      case 'deleteContentForward':
        this.consume(e);
        this.inspection().type([DELETE]);
        return;
    }
  }

  protected onInput(e: Event): void {
    if ((e as InputEvent).isComposing) return;
    this.restoreSentinel();
  }

  protected onCompositionEnd(e: CompositionEvent): void {
    this.typeText(e.data);
    this.restoreSentinel();
  }

  /**
   * Puts the caret back after the sentinel where a tap on the field placed it
   * in front, which would leave a soft keyboard's Backspace nothing to delete.
   */
  protected placeCaret(): void {
    const field = this.field().nativeElement;
    field.setSelectionRange(SENTINEL.length, SENTINEL.length);
  }

  protected onFocusOut(): void {
    this.focused.set(false);
    this.inspection().releaseHeld();
  }

  /**
   * Opens the Type text dialog; what it closes with goes out as taps, and the
   * focus comes back to the capture field either way.
   */
  public openTypeText(): void {
    const ref = this.dialogs.open(TypeTextDialogComponent, {
      header: this.translation.translate(
        'components.def.KEYBOARD.typeText.header'
      ),
      width: '32rem',
      modal: true,
      closable: true,
      telemetryId: DialogId.TypeText
    });
    this.typeTextRef = ref;
    ref.onClose.subscribe((codes) => {
      this.typeTextRef = null;
      if (codes) this.inspection().type(codes);
      this.field().nativeElement.focus({ preventScroll: true });
    });
  }

  protected cancel(): void {
    this.inspection().cancel();
  }

  /** Sends `text` as taps, as a paste does, and says what it left out. */
  private typeText(text: string): void {
    const result = textToCodes(text);
    this.inspection().type(result.codes);
    this.report(result);
  }

  private report(result: KeyboardText): void {
    if (result.skipped.length > 0) {
      this.showSkipped(result.skipped, result.truncated);
    } else if (result.truncated) {
      this.showNotice(this.truncatedMessage());
    }
  }

  private showSkipped(skipped: readonly string[], truncated: boolean): void {
    const message =
      skipped.length === 1
        ? this.translation.translate(
            'components.def.KEYBOARD.window.skippedOne',
            { char: skipped[0] }
          )
        : this.translation.translate(
            'components.def.KEYBOARD.window.skippedMany',
            { count: skipped.length }
          );
    this.showNotice(
      truncated ? `${message} · ${this.truncatedMessage()}` : message
    );
  }

  private truncatedMessage(): string {
    return this.translation.translate(
      'components.def.KEYBOARD.window.truncated',
      {
        limit: KEYBOARD_TEXT_LIMIT.toLocaleString(
          this.translation.getActiveLang()
        )
      }
    );
  }

  private showNotice(message: string): void {
    clearTimeout(this.noticeTimer);
    this.notice.set(message);
    this.noticeTimer = setTimeout(() => this.notice.set(null), NOTICE_MS);
  }

  private consume(e: InputEvent): void {
    if (e.cancelable) e.preventDefault();
  }

  private restoreSentinel(): void {
    this.field().nativeElement.value = SENTINEL;
    this.placeCaret();
  }
}
