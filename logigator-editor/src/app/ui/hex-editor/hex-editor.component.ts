import {
  booleanAttribute,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslationService } from '../../translation/translation.service';
import {
  ConfirmationService,
  LgButton,
  LgInputText,
  LgScroller,
  LgSelectButton
} from '@logigator/ui';
import { LayoutService } from '../../layout/layout.service';
import {
  maxWord,
  packedByteLength,
  readWord,
  resizeBuffer,
  writeWord
} from '../../utils/packed-buffer';
import { ToastService } from '../../logging/toast.service';
import { TranslateDirective } from '../../translation/translate.directive';

type HexView = 'word' | 'byte';
type Radix = 'hex' | 'decimal' | 'octal' | 'binary';

/** How each cell's value is rendered and parsed for a given number base. */
interface RadixSpec {
  base: number;
  /** `log2(base)`; decimal's fractional value sizes its cells. */
  bitsPerDigit: number;
  /** Character class of the digits valid in this base, without brackets. */
  chars: string;
  /** `BigInt` literal prefix. */
  prefix: string;
}

const RADICES: Record<Radix, RadixSpec> = {
  hex: { base: 16, bitsPerDigit: 4, chars: '0-9a-fA-F', prefix: '0x' },
  decimal: { base: 10, bitsPerDigit: 3.3219, chars: '0-9', prefix: '' },
  octal: { base: 8, bitsPerDigit: 3, chars: '0-7', prefix: '0o' },
  binary: { base: 2, bitsPerDigit: 1, chars: '0-1', prefix: '0b' }
};

/**
 * Hex editor over a packed memory buffer. The contract is deliberately generic
 * — a `Uint8Array` plus a word width and word count — so it knows nothing about
 * any specific component, transport or persistence policy. It edits a working
 * copy in a virtualized grid and emits it on save.
 *
 * `readOnly` turns it into a live memory viewer: cells render as plain text,
 * the editing chrome is hidden, and `highlightIndex` marks the currently
 * addressed word — it becomes the active cell and is followed into view while
 * the Follow toggle is on.
 */
@Component({
  selector: 'app-hex-editor',
  imports: [
    FormsModule,
    TranslateDirective,
    LgButton,
    LgSelectButton,
    LgInputText,
    LgScroller
  ],
  templateUrl: './hex-editor.component.html'
})
export class HexEditorComponent {
  private readonly layout = inject(LayoutService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translation = inject(TranslationService);
  private readonly toastService = inject(ToastService);

  /** Initial contents; padded or truncated to the table size. */
  public readonly data = input<Uint8Array>(new Uint8Array(0));
  /** Bits per word. */
  public readonly wordSize = input.required<number>();
  public readonly wordCount = input.required<number>();
  /** Viewer mode: no cell editing and no editing chrome. */
  public readonly readOnly = input(false, { transform: booleanAttribute });
  /** Word index marked as the currently addressed one (viewer mode). */
  public readonly highlightIndex = input<number | null>(null);
  /** Height of the virtualized grid viewport; `100%` fills a flexed host. */
  public readonly scrollHeight = input('28rem');

  public readonly saved = output<Uint8Array>();
  public readonly dismissed = output<void>();

  protected readonly isCompact = this.layout.isCompact;
  protected readonly isTouch = this.layout.isTouch;

  private readonly scroller = viewChild(LgScroller);
  /** The header's content row and its column cells. Always rendered and
   * column-aligned with the body, so it also serves as the measuring proxy for
   * scrolling a column into view. */
  private readonly headerRow = viewChild<ElementRef<HTMLElement>>('headerRow');
  private readonly headerCols =
    viewChild<ElementRef<HTMLElement>>('headerCols');

  /** Working copy, sized to the current dimensions. Replaced on every edit. */
  protected readonly buffer = signal<Uint8Array>(new Uint8Array(0));
  protected readonly view = signal<HexView>('word');
  /** Number base each cell is displayed and edited in. Addresses stay hex. */
  protected readonly radix = signal<Radix>('hex');
  protected readonly radixSpec = computed(() => RADICES[this.radix()]);
  protected readonly gotoInput = signal('');
  protected readonly gotoInvalid = computed(() =>
    /[^0-9a-fA-F]/.test(this.gotoInput())
  );
  /** Index of the focused cell, surfaced in the status box. */
  protected readonly activeCell = signal<number | null>(null);
  /** Keep the highlighted cell scrolled into view (viewer mode). */
  protected readonly follow = signal(true);

  protected readonly addressText =
    this.translation.translate('hexEditor.address');

  // Translated here rather than in an `#item` template: the select button's
  // option type is `unknown`, so a key read off the template context carries no
  // type. `computed` keeps the labels live across a language switch.
  protected readonly viewOptions = computed(() => [
    {
      label: this.translation.translate('hexEditor.wordView'),
      value: 'word' as HexView
    },
    {
      label: this.translation.translate('hexEditor.byteView'),
      value: 'byte' as HexView
    }
  ]);

  protected readonly radixOptions = computed(() => [
    {
      label: this.translation.translate('hexEditor.hex'),
      value: 'hex' as Radix
    },
    {
      label: this.translation.translate('hexEditor.decimal'),
      value: 'decimal' as Radix
    },
    {
      label: this.translation.translate('hexEditor.octal'),
      value: 'octal' as Radix
    },
    {
      label: this.translation.translate('hexEditor.binary'),
      value: 'binary' as Radix
    }
  ]);

  protected readonly byteCount = computed(() =>
    packedByteLength(this.wordCount(), this.wordSize())
  );
  protected readonly cellBits = computed(() =>
    this.view() === 'word' ? this.wordSize() : 8
  );
  protected readonly cellDigits = computed(() =>
    Math.ceil(this.cellBits() / this.radixSpec().bitsPerDigit)
  );
  /** Cells flex to share spare width but never shrink below this; past it the
   * grid scrolls horizontally instead. */
  protected readonly cellMinWidthCh = computed(
    () => this.cellDigits() + (this.isTouch() ? 3 : 2)
  );
  protected readonly gutterWidthCh = computed(
    () => Math.max(this.addressDigits(), this.addressText.length) + 3
  );
  /** Minimum width of a full row — the grid scrolls horizontally below this. */
  protected readonly rowMinWidthCh = computed(
    () => this.gutterWidthCh() + this.columns() * this.cellMinWidthCh()
  );
  protected readonly cellCount = computed(() =>
    this.view() === 'word' ? this.wordCount() : this.byteCount()
  );
  /** Always a full 0–F line; the grid scrolls if it can't fit. */
  protected readonly columns = computed(() => 16);
  protected readonly columnIndexes = computed(() =>
    Array.from({ length: this.columns() }, (_, i) => i)
  );
  protected readonly rowCount = computed(() =>
    Math.ceil(this.cellCount() / this.columns())
  );
  /** Scroller items — one entry per row (the row's first cell index). */
  protected readonly rows = computed(() => {
    const cols = this.columns();
    return Array.from({ length: this.rowCount() }, (_, r) => r * cols);
  });
  protected readonly addressDigits = computed(() =>
    Math.max(2, (this.cellCount() - 1).toString(16).length)
  );

  /** Readout of the focused cell for the status box, or null when none is
   * focused. Recomputes on edits so the value stays live. */
  protected readonly active = computed(() => {
    const index = this.activeCell();
    if (index === null || index >= this.cellCount()) return null;
    const value =
      this.view() === 'word'
        ? readWord(this.buffer(), index, this.wordSize())
        : BigInt(this.buffer()[index] ?? 0);
    return {
      address: index
        .toString(16)
        .toUpperCase()
        .padStart(this.addressDigits(), '0'),
      value: value
        .toString(this.radixSpec().base)
        .toUpperCase()
        .padStart(this.cellDigits(), '0'),
      decimal: value.toString(10)
    };
  });

  protected readonly rowHeight = computed(() => (this.isTouch() ? 44 : 36));

  constructor() {
    // Re-seed the working buffer whenever the inputs change. The reset runs
    // untracked so edits to `buffer` don't feed back into this effect.
    effect(() => {
      this.data();
      this.wordSize();
      this.wordCount();
      untracked(() => this.reset());
    });

    // Make the highlighted word the active cell, and follow it into view while
    // Follow is on. Re-tracked on a view switch so the byte view lands on the
    // same word. A click can still activate another cell until the address
    // next changes.
    effect(() => {
      const word = this.highlightIndex();
      const byteView = this.view() === 'byte';
      if (word === null) {
        return;
      }
      const cell = byteView ? Math.floor((word * this.wordSize()) / 8) : word;
      if (cell >= this.cellCount()) {
        return;
      }
      const follow = this.follow();
      untracked(() => {
        this.activeCell.set(cell);
        if (follow) {
          this.scrollCellIntoView(cell);
        }
      });
    });
  }

  private reset(): void {
    this.view.set('word');
    this.radix.set('hex');
    this.gotoInput.set('');
    this.activeCell.set(null);
    this.buffer.set(resizeBuffer(this.data(), this.byteCount()));
  }

  protected addressLabel(rowStart: number): string {
    return rowStart
      .toString(16)
      .padStart(this.addressDigits(), '0')
      .toUpperCase();
  }

  protected isPadCell(cellIndex: number): boolean {
    return cellIndex >= this.cellCount();
  }

  protected cellHighlight(cellIndex: number): string {
    return this.isHighlighted(cellIndex)
      ? 'bg-primary-500/20 font-semibold text-primary-700 dark:text-primary-300'
      : '';
  }

  /** The word itself in word view, any byte it touches in byte view. */
  private isHighlighted(cellIndex: number): boolean {
    const word = this.highlightIndex();
    if (word === null) {
      return false;
    }
    if (this.view() === 'word') {
      return cellIndex === word;
    }
    const wordSize = this.wordSize();
    const first = Math.floor((word * wordSize) / 8);
    const last = Math.floor(((word + 1) * wordSize - 1) / 8);
    return cellIndex >= first && cellIndex <= last;
  }

  protected cellValue(cellIndex: number): string {
    if (this.isPadCell(cellIndex)) return '';
    const bytes = this.buffer();
    const value =
      this.view() === 'word'
        ? readWord(bytes, cellIndex, this.wordSize())
        : BigInt(bytes[cellIndex] ?? 0);
    return value
      .toString(this.radixSpec().base)
      .padStart(this.cellDigits(), '0')
      .toUpperCase();
  }

  /** Blocks insertion of any character invalid in the active radix. */
  protected onCellBeforeInput(event: InputEvent): void {
    const invalid = new RegExp(`[^${this.radixSpec().chars}]`);
    if (event.data !== null && invalid.test(event.data)) {
      event.preventDefault();
    }
  }

  /**
   * Commits a cell edit, then force-writes the canonical value back into the
   * field: the `[value]` binding leaves the DOM alone when the stored value is
   * unchanged (an entry that parses back to the same number, or a clamp), so
   * without this the field keeps showing the raw text the user typed.
   */
  protected onCellCommit(cellIndex: number, el: HTMLInputElement): void {
    this.onCellInput(cellIndex, el.value);
    el.value = this.cellValue(cellIndex);
  }

  protected onCellInput(cellIndex: number, raw: string): void {
    if (this.isPadCell(cellIndex)) return;
    this.writeValuesFrom(cellIndex, [this.parseDigits(raw)]);
  }

  /** Parses a digit string in the active radix to a value (empty ⇒ 0). */
  private parseDigits(raw: string): bigint {
    const { chars, prefix } = this.radixSpec();
    const digits = raw.replace(new RegExp(`[^${chars}]`, 'g'), '');
    return digits ? BigInt(prefix + digits) : 0n;
  }

  /** Writes consecutive values into the buffer, clamped, stopping at the end. */
  private writeValuesFrom(startIndex: number, values: bigint[]): void {
    if (!values.length) return;
    const word = this.view() === 'word';
    const max = maxWord(this.cellBits());
    const count = this.cellCount();
    const next = Uint8Array.from(this.buffer());
    for (let i = 0; i < values.length && startIndex + i < count; i++) {
      const value = values[i] > max ? max : values[i];
      if (word) writeWord(next, startIndex + i, this.wordSize(), value);
      else next[startIndex + i] = Number(value);
    }
    this.buffer.set(next);
  }

  /**
   * Splits pasted text into per-cell values in the active radix: separated
   * tokens, or, for one unbroken run, chunks of `cellDigits` digits. Lets a
   * dump be pasted across many cells at once.
   */
  private parseValues(text: string): bigint[] {
    const { chars, prefix } = this.radixSpec();
    const tokens = text
      .trim()
      .split(new RegExp(`[^${chars}]+`))
      .filter(Boolean);
    if (!tokens.length) return [];
    const digits = this.cellDigits();
    const chunks =
      tokens.length === 1 && tokens[0].length > digits
        ? (tokens[0].match(new RegExp(`.{1,${digits}}`, 'g')) ?? [])
        : tokens;
    return chunks.map((chunk) => BigInt(prefix + chunk));
  }

  /** Pastes a blob into the focused cell and the cells that follow it. */
  protected onCellPaste(cellIndex: number, event: ClipboardEvent): void {
    const values = this.parseValues(event.clipboardData?.getData('text') ?? '');
    if (!values.length) return;
    event.preventDefault();
    this.writeValuesFrom(cellIndex, values);
  }

  /** The whole buffer rendered as text — `columns` cells per line. */
  protected dump(): string {
    const cols = this.columns();
    const count = this.cellCount();
    const lines: string[] = [];
    for (let i = 0; i < count; i += cols) {
      const row: string[] = [];
      for (let c = 0; c < cols && i + c < count; c++) {
        row.push(this.cellValue(i + c));
      }
      lines.push(row.join(' '));
    }
    return lines.join('\n');
  }

  protected copyAll(): void {
    // Optional chaining yields `undefined` when the Clipboard API is absent,
    // so guard that before attaching to the promise.
    const copied = navigator.clipboard?.writeText(this.dump());
    if (!copied) {
      this.toastService.warn(
        this.translation.translate('hexEditor.copyFailed'),
        'HexEditorComponent'
      );
      return;
    }
    void copied.catch((err: unknown) =>
      this.toastService.warn(
        this.translation.translate('hexEditor.copyFailed'),
        'HexEditorComponent',
        err
      )
    );
  }

  protected goto(): void {
    const raw = this.gotoInput().replace(/[^0-9a-fA-F]/g, '');
    if (!raw) return;
    const cell = Math.min(Number(BigInt('0x' + raw)), this.cellCount() - 1);
    this.scrollCellIntoView(cell, 'smooth');
  }

  private scrollCellIntoView(cell: number, behavior?: ScrollBehavior): void {
    const cols = this.columns();
    this.scroller()?.scrollToIndex(Math.floor(cell / cols), behavior);
    this.scrollColumnIntoView(cell % cols);
  }

  /** Mirrors the body's horizontal scroll offset onto the header row. It
   * translates rather than scrolls the row: a transform is not clamped to the
   * header's own scroll range, whose end can sit a vertical scrollbar's width
   * off the body's. */
  protected syncHeaderScroll(): void {
    const row = this.headerRow()?.nativeElement;
    const viewport = this.scroller()?.viewportElement;
    if (!row || !viewport) return;
    row.style.transform = `translate3d(${-viewport.scrollLeft}px, 0, 0)`;
  }

  /** Measures the always-rendered header cell as a proxy for the body cell,
   * which the virtualized grid may not have rendered. */
  private scrollColumnIntoView(col: number): void {
    const viewport = this.scroller()?.viewportElement;
    const row = this.headerRow()?.nativeElement;
    const colEl = this.headerCols()?.nativeElement.children[col] as
      HTMLElement | undefined;
    if (!viewport || !row || !colEl) return;

    // Content-space offset: both rects carry the header row's translation, so
    // it cancels out.
    const left =
      colEl.getBoundingClientRect().left - row.getBoundingClientRect().left;
    const right = left + colEl.offsetWidth;
    if (left < viewport.scrollLeft) {
      viewport.scrollTo({ left, behavior: 'smooth' });
    } else if (right > viewport.scrollLeft + viewport.clientWidth) {
      viewport.scrollTo({
        left: right - viewport.clientWidth,
        behavior: 'smooth'
      });
    }
  }

  /** Confirms (anchored to the Clear button) before wiping the buffer. */
  protected confirmClear(event: Event): void {
    this.confirmationService.confirm({
      key: 'inline',
      target: event.currentTarget as HTMLElement,
      message: this.translation.translate('hexEditor.clearConfirm'),
      acceptButtonProps: { severity: 'danger' },
      acceptLabel: this.translation.translate('hexEditor.clear'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      rejectLabel: this.translation.translate('common.cancel'),
      accept: () => this.clear()
    });
  }

  protected clear(): void {
    this.buffer.set(new Uint8Array(this.byteCount()));
  }

  protected commit(): void {
    this.saved.emit(this.buffer());
  }

  protected dismiss(): void {
    this.dismissed.emit();
  }
}
