import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  model,
  numberAttribute,
  ChangeDetectionStrategy
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LgButton } from '../button/button';
import { LgDivider } from '../divider/divider';
import { LgMarkdown } from '../markdown/markdown';
import { LgSelectButton } from '../select-button/select-button';
import { LgTooltip } from '../tooltip/tooltip';
import { lgLabel } from '../../tokens/labels';
import {
  applyMarkdownTool,
  LG_MARKDOWN_TOOL_GROUPS,
  LG_MARKDOWN_TOOLS,
  type LgMarkdownTool
} from '../../internal/markdown-insert';

/**
 * Which panes the field is showing. `split` is both at once — side by side
 * where the field is wide enough, stacked where it is not.
 */
export type LgMarkdownView = 'write' | 'split' | 'preview';

/** One toolbar button: what it does, what it is called, what it looks like. */
interface ToolButton {
  tool: LgMarkdownTool;
  label: string;
  icon: string;
  /** A rule follows, the way the editor's own toolbar separates its groups. */
  endsGroup: boolean;
}

/**
 * A textarea with a formatting toolbar, a counter and a preview.
 *
 * It **projects** the consumer's own `<textarea>` rather than building one:
 * that is what keeps `formControlName` or `ngModel`, the `id` a label points
 * at, `maxlength`, and the `aria-describedby` an `lg-form-field` hands out
 * exactly where they already were. The field never owns the value — it edits
 * the element in place and lets the `input` event the browser would have
 * raised carry the change back to whatever is bound.
 *
 * ```html
 * <lg-markdown-field [value]="form.controls.bio.value" [maxLength]="500">
 *   <textarea lgTextarea rows="6" formControlName="bio"></textarea>
 * </lg-markdown-field>
 * ```
 *
 * The preview renders through {@link LgMarkdown} in `userContent` mode, which
 * is the same rule the page will render it under — so what an author checks
 * here is what a reader gets, rather than an approximation of it.
 */
@Component({
  selector: 'lg-markdown-field',
  imports: [
    FormsModule,
    LgButton,
    LgDivider,
    LgMarkdown,
    LgSelectButton,
    LgTooltip
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex flex-col gap-1.5',
    '[attr.data-view]': 'view()',
    '(input)': 'onInput($event)'
  },
  template: `
    <div
      class="flex flex-wrap items-center gap-1"
      role="group"
      [attr.aria-label]="toolbarLabel()"
      (mousedown)="keepCaret($event)"
    >
      @for (button of buttons(); track button.tool) {
        <button
          lgButton
          type="button"
          size="sm"
          severity="none"
          [icon]="button.icon"
          [ariaLabel]="button.label"
          [lgTooltip]="button.label"
          [disabled]="view() === 'preview'"
          disabledInteractive
          (onClick)="applyTool(button.tool)"
        ></button>
        @if (button.endsGroup) {
          <lg-divider layout="vertical" class="mx-0.5 h-5 self-center" />
        }
      }
    </div>

    <div class="panes">
      <!-- Hidden rather than removed: the projected control keeps its
           identity, its value and the label pointing at it while the
           preview has the floor. -->
      <div class="pane" [hidden]="view() === 'preview'">
        <ng-content />
      </div>

      @if (view() !== 'write') {
        <div
          class="pane min-h-28 overflow-auto rounded-md border border-border px-3 py-2"
          role="group"
          [attr.aria-label]="previewLabel()"
        >
          <!-- The links are claimed: following one would throw away an edit
               in progress, and the point is to see the text, not visit it. -->
          <lg-markdown
            [data]="text()"
            userContent
            (linkClick)="$event.preventDefault()"
          />
        </div>
      }
    </div>

    <div class="flex items-center justify-between gap-3">
      <!-- Silent to a screen reader: the accessible answer to "how long may
           this be" is the maxlength on the textarea itself, which the browser
           both announces and enforces. A live count talks over typing. -->
      <p
        class="text-xs tabular-nums"
        aria-hidden="true"
        [class.text-error]="over()"
      >
        {{ counter() }}
      </p>
      <lg-select-button
        size="sm"
        [options]="views()"
        optionLabel="label"
        optionValue="value"
        [allowEmpty]="false"
        [ariaLabel]="viewModeLabel()"
        [ngModel]="view()"
        (ngModelChange)="setView($event)"
        [ngModelOptions]="{ standalone: true }"
      />
    </div>
  `,
  styles: `
    /* The field is the container, not the viewport: the same component sits
       in a 28rem dialog and on a full-width page, and a media query would
       answer for the window instead of for the space it actually has. */
    :host {
      container-type: inline-size;
    }

    .panes {
      display: grid;
      gap: 0.375rem;
    }

    /* Side by side once there is room for two readable columns; stacked
       below that, which is still the text and its rendering at the same
       time — the point of the mode — just one above the other.

       28rem is where the real surfaces fall either side: a 32rem dialog and
       the account page leave the field about 470-500px and split, while the
       editor's 28rem dialogs leave it 408px and stack. Two 200px columns
       would be worse than one full-width one. */
    @container (min-width: 28rem) {
      :host([data-view='split']) .panes {
        grid-template-columns: 1fr 1fr;
        align-items: start;
      }
    }

    /* A pane is a grid item, and a grid item defaults to min-width auto,
       which refuses to shrink below its content — one long unbroken word in
       the preview would push the textarea out of the dialog. */
    .pane {
      min-width: 0;
    }
  `
})
export class LgMarkdownField {
  /**
   * The current text, mirrored rather than owned.
   *
   * An input and not a DOM read, because a server render draws the counter
   * before there is an element to read, and because a programmatic write has
   * to win: the account page puts the *trimmed* bio back after a save, and a
   * field trusting what was last typed would show the wrong length against
   * the right text.
   *
   * **Bind something reactive.** `control.value` is a plain getter, and this
   * is a zoneless app — nothing marks the view dirty when a form control
   * changes, so a binding on it would stick at whatever it read first. A
   * signal works: `toSignal(control.valueChanges, { initialValue: … })` for a
   * reactive form, or the `signal()` behind an `ngModel`. Typing is covered
   * either way, the field reading the element on every keystroke.
   */
  readonly value = input<string>('');
  /** What the counter counts against. The textarea keeps its own `maxlength`. */
  readonly maxLength = input(undefined, { transform: numberAttribute });
  /**
   * Which panes are showing; two-way, so a consumer can reset it on open.
   *
   * `split` by default: the rendering is the point of writing markdown, and a
   * preview nobody opens is a preview nobody reads. A call site with no room
   * for it can open on `write`.
   */
  readonly view = model<LgMarkdownView>('split');
  /** The tools to offer. A bio is not a document, and may want fewer. */
  readonly tools = input<readonly LgMarkdownTool[]>(LG_MARKDOWN_TOOLS);

  readonly toolbarLabel = input(lgLabel('formatting'));
  readonly viewModeLabel = input(lgLabel('viewMode'));
  readonly writeLabel = input(lgLabel('write'));
  readonly splitLabel = input(lgLabel('split'));
  readonly previewLabel = input(lgLabel('preview'));
  readonly heading1Label = input(lgLabel('heading1'));
  readonly heading2Label = input(lgLabel('heading2'));
  readonly heading3Label = input(lgLabel('heading3'));
  readonly boldLabel = input(lgLabel('bold'));
  readonly italicLabel = input(lgLabel('italic'));
  readonly codeLabel = input(lgLabel('code'));
  readonly linkLabel = input(lgLabel('link'));
  readonly bulletedListLabel = input(lgLabel('bulletedList'));
  readonly numberedListLabel = input(lgLabel('numberedList'));
  readonly quoteLabel = input(lgLabel('quote'));
  readonly dividerLabel = input(lgLabel('divider'));
  readonly tableLabel = input(lgLabel('table'));

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /**
   * What the counter and the preview read. Seeded and re-seeded from `value`,
   * written by every keystroke, so it is live while typing and correct again
   * the moment the consumer writes.
   */
  protected readonly text = linkedSignal(() => this.value());

  /**
   * Counted in UTF-16 units, not code points, because that is what actually
   * stops the typing: the textarea's `maxlength`, the contract's `.max()` and
   * the refusal below all count them. A counter that measured what a reader
   * sees would sit at "250 / 500" while the field refused the next keystroke.
   */
  protected readonly length = computed(() => this.text().length);
  protected readonly over = computed(() => {
    const max = this.maxLength();
    return max !== undefined && this.length() > max;
  });
  protected readonly counter = computed(() => {
    const max = this.maxLength();
    return max === undefined ? `${this.length()}` : `${this.length()} / ${max}`;
  });

  protected readonly views = computed(() => [
    { label: this.writeLabel(), value: 'write' as const },
    { label: this.splitLabel(), value: 'split' as const },
    { label: this.previewLabel(), value: 'preview' as const }
  ]);

  protected readonly buttons = computed<ToolButton[]>(() => {
    const labels: Record<LgMarkdownTool, string> = {
      heading1: this.heading1Label(),
      heading2: this.heading2Label(),
      heading3: this.heading3Label(),
      bold: this.boldLabel(),
      italic: this.italicLabel(),
      code: this.codeLabel(),
      link: this.linkLabel(),
      bulletedList: this.bulletedListLabel(),
      numberedList: this.numberedListLabel(),
      quote: this.quoteLabel(),
      divider: this.dividerLabel(),
      table: this.tableLabel()
    };
    const shown = this.tools();
    return shown.map((tool, index) => ({
      tool,
      label: labels[tool],
      icon: ICONS[tool],
      // Never after the last one, and never where the consumer's own tool
      // list has already dropped the rest of the group.
      endsGroup:
        index < shown.length - 1 && LG_MARKDOWN_TOOL_GROUPS.includes(tool)
    }));
  });

  /** A keystroke in the projected control; the counter follows the element. */
  protected onInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) {
      this.text.set(target.value);
    }
  }

  protected setView(view: LgMarkdownView): void {
    this.view.set(view);
    if (view !== 'preview') {
      // Focus would otherwise be left on a button beside a control that has
      // just reappeared; put it back where the text is. After the render, so
      // there is something focusable to put it on.
      afterNextRender(() => this.field()?.focus(), { injector: this.injector });
    }
  }

  /**
   * Keeps the caret where it is when a toolbar button is pressed. The button
   * still takes focus from the keyboard, where Tab and Enter are the way in.
   */
  protected keepCaret(event: MouseEvent): void {
    event.preventDefault();
  }

  protected applyTool(tool: LgMarkdownTool): void {
    // The buttons are disabled in preview, and `LgButton` swallows a click on
    // an inactive one — but they are `disabledInteractive`, so they stay
    // focusable and clickable in the DOM, and a tool must not write into a
    // textarea the author cannot see whichever component is asked first.
    if (this.view() === 'preview') {
      return;
    }
    const field = this.field();
    if (!field || field.disabled || field.readOnly) {
      return;
    }
    const { value, selectionStart, selectionEnd } = field;
    const edit = applyMarkdownTool(
      value,
      selectionStart ?? value.length,
      selectionEnd ?? value.length,
      tool
    );

    const next =
      value.slice(0, edit.start) + edit.replacement + value.slice(edit.end);
    const max = this.maxLength();
    if (max !== undefined && next.length > max && next.length > value.length) {
      // `maxlength` bounds typing, not a scripted write, so the field has to
      // refuse this itself rather than quietly overrun the column.
      return;
    }

    field.focus();
    const from = edit.start + edit.selectFrom;
    const to = edit.start + edit.selectTo;

    // The browser's own insertion first: it is the only one that leaves the
    // undo stack intact, so Ctrl+Z takes a formatting click back as one step.
    field.setSelectionRange(edit.start, edit.end);
    if (!insertText(edit.replacement)) {
      // Refused: assign, and accept that this insertion is not undoable. The
      // boolean is the feature test — `queryCommandSupported` is deprecated
      // and answers unreliably in the browsers that still have it.
      field.value = next;
      field.dispatchEvent(
        new Event('input', { bubbles: true, cancelable: false })
      );
    }
    field.setSelectionRange(from, to);
    this.text.set(field.value);
  }

  /** The projected control, looked up per use rather than queried up front. */
  private field(): HTMLTextAreaElement | null {
    return this.host.nativeElement.querySelector('textarea');
  }
}

/** Phosphor's regular weight, which both apps load. */
const ICONS: Record<LgMarkdownTool, string> = {
  heading1: 'ph ph-text-h-one',
  heading2: 'ph ph-text-h-two',
  heading3: 'ph ph-text-h-three',
  bold: 'ph ph-text-b',
  italic: 'ph ph-text-italic',
  code: 'ph ph-code',
  link: 'ph ph-link',
  bulletedList: 'ph ph-list-bullets',
  numberedList: 'ph ph-list-numbers',
  quote: 'ph ph-quotes',
  divider: 'ph ph-minus',
  table: 'ph ph-table'
};

/**
 * Inserts over the current selection through the browser, reporting whether it
 * worked. Deprecated and still the only way to write into a textarea without
 * discarding its undo history, which is why it is tried before anything else.
 */
function insertText(text: string): boolean {
  try {
    // The element is focused by the caller, which is the condition engines
    // silently no-op on. The boolean is the feature test: `queryCommandSupported`
    // is deprecated and answers unreliably where it still exists.
    return (
      typeof document.execCommand === 'function' &&
      document.execCommand('insertText', false, text)
    );
  } catch {
    return false;
  }
}
