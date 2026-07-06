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
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
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

type HexView = 'word' | 'byte';
type Radix = 'hex' | 'decimal' | 'octal' | 'binary';

/** How each cell's value is rendered and parsed for a given number base. */
interface RadixSpec {
  /** Base passed to `Number/BigInt.toString` and used to size cells. */
  base: number;
  /** Bits encoded per digit (`log2(base)`): hex 4, octal 3, binary 1. */
  bitsPerDigit: number;
  /** Character class (without brackets) of the digits valid in this base. */
  chars: string;
  /** `BigInt` literal prefix for parsing a digit string in this base. */
  prefix: string;
}

const RADICES: Record<Radix, RadixSpec> = {
  hex: { base: 16, bitsPerDigit: 4, chars: '0-9a-fA-F', prefix: '0x' },
  decimal: { base: 10, bitsPerDigit: 3.3219, chars: '0-9', prefix: '' },
  octal: { base: 8, bitsPerDigit: 3, chars: '0-7', prefix: '0o' },
  binary: { base: 2, bitsPerDigit: 1, chars: '0-1', prefix: '0b' }
};

/**
 * A hex editor for a packed memory buffer. It is a plain, self-contained
 * component (no dialog wrapper) — place it anywhere, or open it in a
 * `DynamicDialog` (see {@link MemoryDataOptionInputComponent}). Its contract is
 * deliberately generic — a `Uint8Array` plus a word width and word count — so
 * it knows nothing about any specific component, base64 transport, or
 * persistence policy; callers adapt their own storage to this interface. It
 * seeds a working copy from the inputs, lets the user edit it in a virtualized
 * grid (word- or byte-addressed), and emits the edited `Uint8Array` on save /
 * a bare event on cancel. The grid is virtualized so a large word count stays
 * responsive, and it adapts column count / sizing for compact and touch layouts.
 *
 * With `readOnly`, it doubles as a live memory *viewer* (the ROM inspection):
 * cells render as plain text, the editing chrome (Clear, Save/Cancel) is
 * hidden, and `highlightIndex` marks the currently addressed word — it becomes
 * the active cell (so the status box reads out the live address and value)
 * and is followed into view while the Follow toggle is on. The host sizes it:
 * the default `scrollHeight` keeps the dialog layout, `100%` fills a flexed
 * container.
 */
@Component({
  selector: 'app-hex-editor',
  imports: [
    FormsModule,
    TranslocoDirective,
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
  private readonly transloco = inject(TranslocoService);
  private readonly toastService = inject(ToastService);

  /** Initial contents as a packed buffer; padded/truncated to the table size. */
  public readonly data = input<Uint8Array>(new Uint8Array(0));
  /** Bits per word. */
  public readonly wordSize = input.required<number>();
  /** Number of addressable words. */
  public readonly wordCount = input.required<number>();
  /** Viewer mode: no cell editing and no editing chrome (Clear, Save/Cancel). */
  public readonly readOnly = input(false, { transform: booleanAttribute });
  /** Word index highlighted as the currently addressed one (viewer mode). */
  public readonly highlightIndex = input<number | null>(null);
  /** Height of the virtualized grid viewport; `100%` fills a flexed host. */
  public readonly scrollHeight = input('28rem');

  /** Emits the edited contents (packed buffer, table-sized) when the user saves. */
  public readonly saved = output<Uint8Array>();
  /** Emits when the user cancels without saving. */
  public readonly dismissed = output<void>();

  protected readonly isCompact = this.layout.isCompact;
  protected readonly isTouch = this.layout.isTouch;

  private readonly scroller = viewChild(LgScroller);
  /** The horizontal-scroll container and the header's column row, used to bring
   * a searched cell's column into view sideways (the header is always rendered
   * and column-aligned with the body, so it's a reliable measuring proxy). */
  private readonly gridScroll =
    viewChild<ElementRef<HTMLElement>>('gridScroll');
  private readonly headerCols =
    viewChild<ElementRef<HTMLElement>>('headerCols');

  /** Working copy, sized to the current dimensions. Replaced on every edit. */
  protected readonly buffer = signal<Uint8Array>(new Uint8Array(0));
  protected readonly view = signal<HexView>('word');
  /** Number base each cell is displayed and edited in. Addresses stay hex. */
  protected readonly radix = signal<Radix>('hex');
  protected readonly radixSpec = computed(() => RADICES[this.radix()]);
  protected readonly gotoInput = signal('');
  /** True when the go-to field holds a non-hex character (drives the red state). */
  protected readonly gotoInvalid = computed(() =>
    /[^0-9a-fA-F]/.test(this.gotoInput())
  );
  /** Index of the focused cell, surfaced in the status box. */
  protected readonly activeCell = signal<number | null>(null);
  /** Keep the highlighted cell scrolled into view (viewer mode). */
  protected readonly follow = signal(true);

  protected readonly addressText =
    this.transloco.translate('hexEditor.address');

  protected readonly viewOptions = [
    { label: 'hexEditor.wordView', value: 'word' as HexView },
    { label: 'hexEditor.byteView', value: 'byte' as HexView }
  ];

  protected readonly radixOptions = [
    { label: 'hexEditor.hex', value: 'hex' as Radix },
    { label: 'hexEditor.decimal', value: 'decimal' as Radix },
    { label: 'hexEditor.octal', value: 'octal' as Radix },
    { label: 'hexEditor.binary', value: 'binary' as Radix }
  ];

  protected readonly byteCount = computed(() =>
    packedByteLength(this.wordCount(), this.wordSize())
  );
  /** Bits held by one cell — a full word, or 8 in byte view. */
  protected readonly cellBits = computed(() =>
    this.view() === 'word' ? this.wordSize() : 8
  );
  /** Digits to display per cell, in the active radix. */
  protected readonly cellDigits = computed(() =>
    Math.ceil(this.cellBits() / this.radixSpec().bitsPerDigit)
  );
  /**
   * Minimum cell width (in `ch`): its hex digits plus padding. Cells flex to
   * share spare width evenly, but never shrink below this — past that the grid
   * scrolls horizontally instead.
   */
  protected readonly cellMinWidthCh = computed(
    () => this.cellDigits() + (this.isTouch() ? 3 : 2)
  );
  /** Address-gutter width (in `ch`): the address digits plus padding. */
  protected readonly gutterWidthCh = computed(
    () => Math.max(this.addressDigits(), this.addressText.length) + 3
  );
  /** Minimum width of a full row — the grid scrolls horizontally below this. */
  protected readonly rowMinWidthCh = computed(
    () => this.gutterWidthCh() + this.columns() * this.cellMinWidthCh()
  );
  /** Number of cells (words or bytes) in the active view. */
  protected readonly cellCount = computed(() =>
    this.view() === 'word' ? this.wordCount() : this.byteCount()
  );
  /** Cells per row — always a full 0–F line; the grid scrolls if it can't fit. */
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
  /** Width of the address gutter in hex digits. */
  protected readonly addressDigits = computed(() =>
    Math.max(2, (this.cellCount() - 1).toString(16).length)
  );

  /**
   * Address / value readout of the focused cell for the status box, or null
   * when nothing is focused. Recomputes on edits so the value stays live.
   */
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
    // Seed the working buffer from the inputs, re-seeding if they change (a host
    // reusing the instance with new contents). The reset itself runs untracked
    // so writes to `buffer` during editing don't feed back into this effect.
    effect(() => {
      this.data();
      this.wordSize();
      this.wordCount();
      untracked(() => this.reset());
    });

    // Track the highlighted word (and re-track when the view switches, so the
    // byte view lands on the same word): it becomes the active cell — the
    // status box shows its address and value — and, while Follow is on, stays
    // scrolled into view. A click can still activate another cell until the
    // address next changes.
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

  /** First cell index of a row, given the row's anchor (its first cell index). */
  protected addressLabel(rowStart: number): string {
    return rowStart
      .toString(16)
      .padStart(this.addressDigits(), '0')
      .toUpperCase();
  }

  protected isPadCell(cellIndex: number): boolean {
    return cellIndex >= this.cellCount();
  }

  /** Extra classes marking the currently addressed word's cell(s). */
  protected cellHighlight(cellIndex: number): string {
    return this.isHighlighted(cellIndex)
      ? 'bg-primary-500/20 font-semibold text-primary-700 dark:text-primary-300'
      : '';
  }

  /**
   * Whether a cell belongs to the highlighted word — the word itself in word
   * view, any byte it touches in byte view.
   */
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
   * Commits a cell edit and force-corrects the field to the canonical value.
   * The rewrite matters because the `[value]` binding won't touch the DOM when
   * the stored value is unchanged (e.g. an invalid entry that parses back to
   * the same number, or a clamp) — without it the field would keep showing the
   * raw text the user typed.
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
   * Splits pasted text into per-cell values, in the active radix:
   * whitespace/separator-delimited tokens, or — for one unbroken run — chunks
   * of `cellDigits` digits. Lets a dump be pasted across many cells at once.
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
    // Optional chaining short-circuits to `undefined` when the Clipboard API is
    // absent, so guard the absence case before attaching to the promise.
    const copied = navigator.clipboard?.writeText(this.dump());
    if (!copied) {
      this.toastService.warn(
        this.transloco.translate('hexEditor.copyFailed'),
        undefined,
        'HexEditorComponent'
      );
      return;
    }
    void copied.then(
      () =>
        this.toastService.info(this.transloco.translate('hexEditor.copied')),
      (err: unknown) =>
        this.toastService.warn(
          this.transloco.translate('hexEditor.copyFailed'),
          err,
          'HexEditorComponent'
        )
    );
  }

  protected goto(): void {
    const raw = this.gotoInput().replace(/[^0-9a-fA-F]/g, '');
    if (!raw) return;
    const cell = Math.min(Number(BigInt('0x' + raw)), this.cellCount() - 1);
    this.scrollCellIntoView(cell, 'smooth');
  }

  /** Scrolls the cell's row and column into view. */
  private scrollCellIntoView(cell: number, behavior?: ScrollBehavior): void {
    const cols = this.columns();
    this.scroller()?.scrollToIndex(Math.floor(cell / cols), behavior);
    this.scrollColumnIntoView(cell % cols);
  }

  /** Scrolls the grid horizontally so the given column is visible. Measures the
   * always-rendered, column-aligned header cell as a proxy for the body cell. */
  private scrollColumnIntoView(col: number): void {
    const wrapper = this.gridScroll()?.nativeElement;
    const colEl = this.headerCols()?.nativeElement.children[col] as
      | HTMLElement
      | undefined;
    if (!wrapper || !colEl) return;

    const left =
      colEl.getBoundingClientRect().left -
      wrapper.getBoundingClientRect().left +
      wrapper.scrollLeft;
    const right = left + colEl.offsetWidth;
    if (left < wrapper.scrollLeft) {
      wrapper.scrollTo({ left, behavior: 'smooth' });
    } else if (right > wrapper.scrollLeft + wrapper.clientWidth) {
      wrapper.scrollTo({
        left: right - wrapper.clientWidth,
        behavior: 'smooth'
      });
    }
  }

  /** Confirms (anchored to the Clear button) before wiping the buffer. */
  protected confirmClear(event: Event): void {
    this.confirmationService.confirm({
      key: 'inline',
      target: event.currentTarget as HTMLElement,
      message: this.transloco.translate('hexEditor.clearConfirm'),
      acceptButtonProps: { severity: 'danger' },
      acceptLabel: this.transloco.translate('hexEditor.clear'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      rejectLabel: this.transloco.translate('common.cancel'),
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
