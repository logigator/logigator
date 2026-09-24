import {
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  model,
  numberAttribute,
  signal,
  untracked,
  viewChild,
  ViewEncapsulation
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LgButton } from '../button/button';
import { LgDivider } from '../divider/divider';
import { LgInputText } from '../input-text/input-text';
import { LgSelectButton } from '../select-button/select-button';
import { LgTooltip } from '../tooltip/tooltip';
import {
  LG_PROSE_STYLES,
  LG_USER_PROSE_STYLES
} from '../../internal/prose-styles';
import { formFieldClasses } from '../../tokens/form-field';
import { lgLabel } from '../../tokens/labels';
import type { LgSize } from '../../tokens/size';
import {
  applyMarkdownTool,
  LG_MARKDOWN_TOOL_GROUPS,
  LG_MARKDOWN_TOOLS,
  type LgMarkdownTool
} from '../../internal/markdown-insert';
import {
  LG_RICH_STATE_EMPTY,
  LG_TABLE_ACTION_GROUPS,
  LG_TABLE_ACTIONS,
  type LgRichEditor,
  type LgRichState,
  type LgTableAction
} from '../../internal/rich-markdown/contract';

/**
 * Which surface the author is editing on.
 *
 * `rich` is the document itself, edited in place. `source` is the markdown it
 * is stored as — kept, because markdown that came from somewhere else is
 * worth being able to paste, because a `contenteditable` is a worse surface
 * with a screen reader than a `textarea`, and because it is what the field
 * shows wherever the rich editor cannot run.
 */
export type LgMarkdownView = 'rich' | 'source';

/** One toolbar button: what it does, what it is called, what it looks like. */
interface ToolButton {
  tool: LgMarkdownTool;
  label: string;
  icon: string;
  /** A rule follows, the way the editor's own toolbar separates its groups. */
  endsGroup: boolean;
  /** Whether it is on where the caret is; `undefined` outside the rich editor. */
  pressed: boolean | undefined;
}

/** One button in the table row, which is only there while there is a table. */
interface TableButton {
  action: LgTableAction;
  label: string;
  icon: string;
  endsGroup: boolean;
  danger: boolean;
  pressed: boolean | undefined;
}

/**
 * A markdown field with two surfaces over one value.
 *
 * It **projects** the consumer's own `<textarea>` rather than building one:
 * that is what keeps `formControlName` or `ngModel`, the `id` a label points
 * at, `maxlength`, and the `aria-describedby` an `lg-form-field` hands out
 * exactly where they already were. The textarea is also the **value**, in
 * both modes — the rich editor serializes every edit straight back into it —
 * so the form, the counter and the validator all keep reading the one string
 * they already read, and switching to source shows an element that was never
 * out of date rather than performing a conversion.
 *
 * ```html
 * <lg-markdown-field [value]="form.controls.bio.value" [maxLength]="500">
 *   <textarea lgTextarea rows="6" formControlName="bio"></textarea>
 * </lg-markdown-field>
 * ```
 *
 * **The rich editor is a lazy chunk**, fetched after the first render and
 * never on the server. Until it lands — and forever, if it fails to — the
 * projected textarea is what the field shows, which is also what the first
 * byte of a server render carries and what an author with no JavaScript gets.
 *
 * **A document nobody edited is never rewritten.** Opening the rich editor
 * parses the markdown but reports nothing; only an edit the author makes is
 * serialized back. So a description that is merely looked at keeps the exact
 * bytes it was stored with, and the serializer is configured to spell what it
 * writes the way the source toolbar always has.
 */
@Component({
  selector: 'lg-markdown-field',
  imports: [
    FormsModule,
    LgButton,
    LgDivider,
    LgInputText,
    LgSelectButton,
    LgTooltip
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The rich surface and every element in it is built by ProseMirror, not by
  // this template, so an emulated scope's attribute never reaches any of them
  // and every rule below would silently match nothing. Each one is therefore
  // written against the `lg-markdown-field` host or the shared `.lg-prose`
  // class instead.
  encapsulation: ViewEncapsulation.None,
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
          [pressed]="button.pressed"
          [ariaLabel]="button.label"
          [lgTooltip]="button.label"
          (onClick)="applyTool(button.tool)"
        ></button>
        @if (button.endsGroup) {
          <lg-divider layout="vertical" class="mx-0.5 my-1.5" />
        }
      }
    </div>

    <!-- Only while the caret is in a link. A link's words are in the document
         and typed there; its destination is not anywhere a caret can reach, so
         it needs a control of its own — and a row rather than a popover,
         because that is what the table controls already are and because a
         field this size has nowhere to float one. -->
    @if (linkHref() !== undefined) {
      <div
        class="flex items-center gap-1"
        role="group"
        [attr.aria-label]="linkToolsLabel()"
      >
        <input
          #linkInput
          lgInputText
          type="url"
          size="sm"
          class="min-w-0 flex-1"
          spellcheck="false"
          autocapitalize="off"
          [attr.aria-label]="linkUrlLabel()"
          [value]="linkHref() ?? ''"
          (input)="applyLink($event)"
          (keydown.enter)="$event.preventDefault(); focusDocument()"
        />
        <button
          lgButton
          type="button"
          size="sm"
          severity="danger"
          text
          icon="ph ph-link-break"
          [ariaLabel]="removeLinkLabel()"
          [lgTooltip]="removeLinkLabel()"
          (mousedown)="keepCaret($event)"
          (onClick)="removeLink()"
        ></button>
      </div>
    }

    <!-- Only while the caret is in a table: a row of controls for a grid that
         is not there would be a row of controls that do nothing. -->
    @if (tableButtons().length > 0) {
      <div
        class="flex flex-wrap items-center gap-1"
        role="group"
        [attr.aria-label]="tableToolsLabel()"
        (mousedown)="keepCaret($event)"
      >
        @for (button of tableButtons(); track button.action) {
          <button
            lgButton
            type="button"
            size="sm"
            [severity]="button.danger ? 'danger' : 'none'"
            text
            [icon]="button.icon"
            [pressed]="button.pressed"
            [ariaLabel]="button.label"
            [lgTooltip]="button.label"
            (onClick)="applyTableAction(button.action)"
          ></button>
          @if (button.endsGroup) {
            <lg-divider layout="vertical" class="mx-0.5 my-1.5" />
          }
        }
      </div>
    }

    <!-- One box, two surfaces, and the box is what the reader drags.
         The projected control stays **in flow** in both modes — invisible
         rather than removed while the document has the floor — so its rows
         attribute still sets the natural height and the two modes cannot
         disagree about how big the field is. The rich surface lies over it. -->
    <div class="surfaces">
      <div class="source" [class.invisible]="richShowing()">
        <ng-content />
      </div>
      <div #richHost class="rich" [hidden]="!richShowing()"></div>
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
      <!-- Absent until the rich editor is there to switch to, so the control
           never offers a mode the field cannot enter. -->
      @if (richAvailable()) {
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
      }
    </div>
  `,
  styles: [
    LG_PROSE_STYLES,
    LG_USER_PROSE_STYLES,
    `
      /* The one box. CSS resize has no effect where overflow is visible, which
         is why it is clipped here — there is nothing to clip, the library's
         text fields having no focus ring by design, only a border that
         changes colour. */
      lg-markdown-field .surfaces {
        position: relative;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        resize: vertical;
        min-height: 4rem;
      }

      /* A flex-basis of auto, not the zero the flex:1 shorthand would set:
         the textarea's own rows height is what an auto-height box measures
         itself from, and a basis of zero would collapse the field to its
         floor before anybody had dragged anything. */
      lg-markdown-field .surfaces > .source {
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        min-height: 0;
        min-width: 0;
      }

      lg-markdown-field .surfaces > .source > textarea {
        flex: 1 1 auto;
        min-height: 0;
        /* One grip, on the box, rather than one per surface. */
        resize: none;
      }

      lg-markdown-field .surfaces > .rich {
        position: absolute;
        inset: 0;
      }

      /* The hidden attribute is a UA display:none, which any author display
         declared here would outrank. */
      lg-markdown-field .surfaces > .rich[hidden] {
        display: none;
      }

      /* Milkdown's own wrapper, between the element handed to it and the
         editable one. */
      lg-markdown-field .rich > .milkdown {
        height: 100%;
      }

      /* Everything *inside* this is the shared prose stylesheet, which is also
         what draws the finished page, and the box itself is the same chrome
         the textarea wears — both from one definition, so an author looks at
         what a reader will get. */
      lg-markdown-field .lg-rich-surface {
        height: 100%;
        overflow-y: auto;
        /* ProseMirror's own two: a caret must be placeable past the end of a
           line, and a soft break must survive whitespace collapsing. */
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      /* A link looks exactly as it will on the page — colour, no underline —
         and only the cursor differs: this is text being written, not a
         destination, and a click here would throw an edit away rather than
         navigate. */
      lg-markdown-field .lg-rich-surface a {
        cursor: text;
      }

      /* prosemirror-tables marks the cells of a cell selection with this class
         and draws nothing itself; the cell is the positioning context. */
      lg-markdown-field .lg-rich-surface .selectedCell::after {
        content: '';
        position: absolute;
        inset: 0;
        background: color-mix(in srgb, var(--lg-primary) 20%, transparent);
        pointer-events: none;
      }

      /* A table cell is a positioning context for the selection overlay above,
         which the shared rules have no reason to make one. */
      lg-markdown-field .lg-rich-surface th,
      lg-markdown-field .lg-rich-surface td {
        position: relative;
        vertical-align: top;
      }

      lg-markdown-field .lg-rich-surface table {
        table-layout: fixed;
      }

      /* Raw HTML is an atom that renders as the text it was written as — the
         same thing the reader will see, the renderer producing no markup an
         author wrote. Marking it as literal is the only honest affordance. */
      lg-markdown-field .lg-rich-surface [data-type='html'] {
        font-family: var(--font-mono, monospace);
        font-size: 0.85em;
        color: var(--lg-muted);
        background: var(--lg-content-hover);
        border-radius: 0.25rem;
        padding: 0.1em 0.35em;
      }

      /* The gap cursor, for a caret between two blocks nothing else can hold —
         before a leading table, after a trailing rule. */
      lg-markdown-field .lg-rich-surface .ProseMirror-gapcursor {
        display: none;
        pointer-events: none;
        position: absolute;
      }

      lg-markdown-field .lg-rich-surface .ProseMirror-gapcursor:after {
        content: '';
        display: block;
        position: absolute;
        top: -2px;
        width: 20px;
        border-top: 1px solid var(--lg-text);
        animation: lg-gapcursor-blink 1.1s steps(2, start) infinite;
      }

      lg-markdown-field
        .lg-rich-surface.ProseMirror-focused
        .ProseMirror-gapcursor {
        display: block;
      }

      @keyframes lg-gapcursor-blink {
        to {
          visibility: hidden;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        lg-markdown-field .lg-rich-surface .ProseMirror-gapcursor:after {
          animation: none;
        }
      }
    `
  ]
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
   * Which surface is showing; two-way, so a consumer can reset it on open.
   *
   * `rich` by default: editing the document is the point, and a mode nobody
   * switches to is a mode nobody uses. It falls back to `source` on its own
   * wherever the rich editor cannot run.
   */
  readonly view = model<LgMarkdownView>('rich');
  /** The tools to offer. A bio is not a document, and may want fewer. */
  readonly tools = input<readonly LgMarkdownTool[]>(LG_MARKDOWN_TOOLS);
  /**
   * Id of the `<label>` naming this field — `lg-form-field`'s `labelId()`.
   *
   * The rich surface is a `contenteditable`, which no `<label for>` can name,
   * and the projected textarea that *is* named by one is hidden while it
   * shows. Without this the rich editor has no accessible name at all.
   */
  readonly labelledBy = input<string>();
  /** Id of the hint or error — `lg-form-field`'s `describedBy()`. */
  readonly describedBy = input<string>();
  /**
   * Mirrors what the projected `<textarea>` is given.
   *
   * The two surfaces wear one chrome, so a red border while the source shows
   * and none while the document does would be the field disagreeing with
   * itself about whether the value is acceptable. Both are passed rather than
   * one derived from the other, because the textarea is the consumer's
   * element and this component does not write into it.
   */
  readonly invalid = input(false, { transform: booleanAttribute });
  /** Mirrors the projected control's size, for the same reason. */
  readonly size = input<LgSize>();

  readonly toolbarLabel = input(lgLabel('formatting'));
  readonly tableToolsLabel = input(lgLabel('tableTools'));
  readonly viewModeLabel = input(lgLabel('viewMode'));
  readonly richTextLabel = input(lgLabel('richText'));
  readonly markdownSourceLabel = input(lgLabel('markdownSource'));
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
  readonly codeBlockLabel = input(lgLabel('codeBlock'));
  readonly dividerLabel = input(lgLabel('divider'));
  readonly tableLabel = input(lgLabel('table'));
  readonly linkToolsLabel = input(lgLabel('linkTools'));
  readonly linkTextLabel = input(lgLabel('linkText'));
  readonly linkUrlLabel = input(lgLabel('linkUrl'));
  readonly removeLinkLabel = input(lgLabel('removeLink'));
  readonly insertRowAboveLabel = input(lgLabel('insertRowAbove'));
  readonly insertRowBelowLabel = input(lgLabel('insertRowBelow'));
  readonly insertColumnBeforeLabel = input(lgLabel('insertColumnBefore'));
  readonly insertColumnAfterLabel = input(lgLabel('insertColumnAfter'));
  readonly deleteRowLabel = input(lgLabel('deleteRow'));
  readonly deleteColumnLabel = input(lgLabel('deleteColumn'));
  readonly deleteTableLabel = input(lgLabel('deleteTable'));
  readonly alignLeftLabel = input(lgLabel('alignLeft'));
  readonly alignCenterLabel = input(lgLabel('alignCenter'));
  readonly alignRightLabel = input(lgLabel('alignRight'));

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly richHost =
    viewChild.required<ElementRef<HTMLElement>>('richHost');
  private readonly linkInput =
    viewChild<ElementRef<HTMLInputElement>>('linkInput');

  /**
   * What the counter reads. Seeded and re-seeded from `value`, written by
   * every keystroke and by every rich edit, so it is live while typing and
   * correct again the moment the consumer writes.
   */
  protected readonly text = linkedSignal(() => this.value());

  /** The editor handle, once its chunk has landed and it has been built. */
  private editor: LgRichEditor | undefined;
  /** Guards against a second load while the first is in flight. */
  private mounting = false;
  /** The markdown this field last wrote out, so its own echo is ignored. */
  private lastWritten: string | undefined;

  /** The chrome both surfaces wear, from the definition the textarea uses. */
  private readonly surfaceClass = computed(() =>
    formFieldClasses(this.size(), this.invalid())
  );

  protected readonly richAvailable = signal(false);
  protected readonly richState = signal<LgRichState>(LG_RICH_STATE_EMPTY);

  /**
   * The destination of the link the caret is in, or `undefined` where the
   * caret is not in one — which is also the row's own on/off switch.
   *
   * Only in the document: the source view shows a link's destination in the
   * text, where it is already editable.
   */
  protected readonly linkHref = computed(() =>
    this.richShowing() ? this.richState().link : undefined
  );

  /** Whether the rich surface has the floor rather than the textarea. */
  protected readonly richShowing = computed(
    () => this.richAvailable() && this.view() === 'rich'
  );

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
    { label: this.richTextLabel(), value: 'rich' as const },
    { label: this.markdownSourceLabel(), value: 'source' as const }
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
      codeBlock: this.codeBlockLabel(),
      divider: this.dividerLabel(),
      table: this.tableLabel()
    };
    const shown = this.tools();
    // A pressed state is a property of a caret in a document, which the
    // source view does not have: a textarea knows only where the selection
    // is, not what it is inside. So the buttons are plain buttons there,
    // rather than toggles that would be lying about their state.
    const active = this.richShowing() ? this.richState().active : undefined;
    return shown.map((tool, index) => ({
      tool,
      label: labels[tool],
      icon: ICONS[tool],
      // Never after the last one, and never where the consumer's own tool
      // list has already dropped the rest of the group.
      endsGroup:
        index < shown.length - 1 && LG_MARKDOWN_TOOL_GROUPS.includes(tool),
      pressed: active?.includes(tool)
    }));
  });

  /** A keystroke in the link row; the mark follows what is typed. */
  protected applyLink(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.editor?.setLink(target.value);
    }
  }

  protected removeLink(): void {
    this.editor?.removeLink();
    this.focusDocument();
  }

  /** Puts the caret back in the text, where the next keystroke belongs. */
  protected focusDocument(): void {
    this.editor?.focus();
  }

  protected readonly tableButtons = computed<TableButton[]>(() => {
    const state = this.richState();
    if (!this.richShowing() || !state.inTable) {
      return [];
    }
    const labels: Record<LgTableAction, string> = {
      rowBefore: this.insertRowAboveLabel(),
      rowAfter: this.insertRowBelowLabel(),
      colBefore: this.insertColumnBeforeLabel(),
      colAfter: this.insertColumnAfterLabel(),
      deleteRow: this.deleteRowLabel(),
      deleteCol: this.deleteColumnLabel(),
      alignLeft: this.alignLeftLabel(),
      alignCenter: this.alignCenterLabel(),
      alignRight: this.alignRightLabel(),
      deleteTable: this.deleteTableLabel()
    };
    return LG_TABLE_ACTIONS.map((action, index) => ({
      action,
      label: labels[action],
      icon: TABLE_ICONS[action],
      endsGroup:
        index < LG_TABLE_ACTIONS.length - 1 &&
        LG_TABLE_ACTION_GROUPS.includes(action),
      danger: DESTRUCTIVE.has(action),
      pressed: ALIGNMENTS[action]
        ? state.align === ALIGNMENTS[action]
        : undefined
    }));
  });

  constructor() {
    // Browser-only and reactive, so the chunk is fetched once the field is on
    // screen and never during a server render. It is fetched whatever the
    // current mode is: `rich` is the default, and a field that waited for the
    // switch would answer it with a blank surface and a network round trip.
    afterRenderEffect(() => {
      if (this.editor || this.mounting) {
        return;
      }
      void this.mount();
    });

    // A write from outside — a consumer resetting the form, or the account
    // page putting a trimmed bio back. Its own echo is filtered out: the
    // value it just wrote coming back through `value` would replace the
    // document under the caret and send it to the end.
    //
    // The mode is read untracked, and only `value` is a dependency. While the
    // source has the floor the textarea *is* the surface, so parsing every
    // keystroke into a document nobody is looking at would be work for
    // nothing; `setView` re-reads it on the way back in.
    effect(() => {
      const next = this.value();
      if (untracked(() => this.view()) !== 'rich') {
        return;
      }
      if (this.editor && next !== this.lastWritten) {
        this.lastWritten = next;
        this.editor.setValue(next);
      }
    });

    // The chrome is handed over as a getter, and ProseMirror reads it when it
    // updates — which a validity change on its own does not cause.
    effect(() => {
      this.surfaceClass();
      this.editor?.refresh();
    });

    inject(DestroyRef).onDestroy(() => {
      this.editor?.destroy();
      this.editor = undefined;
    });
  }

  private async mount(): Promise<void> {
    this.mounting = true;
    try {
      const { createRichEditor } =
        await import('../../internal/rich-markdown/rich-editor');
      const seed = this.currentText();
      this.editor = await createRichEditor({
        root: this.richHost().nativeElement,
        value: seed,
        editable: () => {
          const field = this.field();
          return !!field && !field.disabled && !field.readOnly;
        },
        linkText: this.linkTextLabel(),
        labelledBy: this.labelledBy(),
        describedBy: this.describedBy(),
        surfaceClass: () => this.surfaceClass(),
        onChange: (markdown) => this.writeBack(markdown),
        onStateChange: (state) => this.richState.set(state)
      });
      this.lastWritten = seed;
      // Typed into the textarea while the chunk was on the network: the
      // editor was seeded from a value that is already stale.
      const current = this.currentText();
      if (current !== seed) {
        this.lastWritten = current;
        this.editor.setValue(current);
      }
      this.richAvailable.set(true);
    } catch {
      // Nothing to recover: the field is a textarea with a toolbar, which is
      // what it already is. The mode control stays hidden, so there is no
      // control offering a surface that will not appear.
      this.view.set('source');
    } finally {
      this.mounting = false;
    }
  }

  /**
   * The rich editor's serialized document, into the control that holds it.
   *
   * The `input` event is the point: it is what a form control's value
   * accessor listens to, so an edit made in the rich surface reaches the
   * consumer's `FormControl` by exactly the path a keystroke does.
   */
  private writeBack(markdown: string): void {
    const field = this.field();
    if (!field || field.value === markdown) {
      return;
    }
    this.lastWritten = markdown;
    // Assigning a value collapses the selection to the end of it, and the
    // control is not the one being typed into — so every rich keystroke would
    // walk the source view's caret to the bottom of the document, and
    // switching to it would focus a caret down there and scroll to meet it.
    const { selectionStart, selectionEnd } = field;
    field.value = markdown;
    field.setSelectionRange(
      Math.min(selectionStart ?? 0, markdown.length),
      Math.min(selectionEnd ?? 0, markdown.length)
    );
    field.dispatchEvent(
      new Event('input', { bubbles: true, cancelable: false })
    );
    this.text.set(markdown);
  }

  /** A keystroke in the projected control; the counter follows the element. */
  protected onInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) {
      this.text.set(target.value);
    }
  }

  protected setView(view: LgMarkdownView): void {
    const previous = this.view();
    if (view === previous) {
      return;
    }
    // Read before the switch, while the surface being left is still the one
    // with the floor.
    const position = scrollRatio(this.surfaceFor(previous));
    this.view.set(view);

    if (view === 'rich') {
      // The source may have been edited, or pasted into wholesale. Re-parsing
      // on the way in is the only direction this conversion runs: on the way
      // out there is nothing to do, the textarea having been current all along.
      const current = this.currentText();
      this.lastWritten = current;
      this.editor?.setValue(current);
    }
    // Focus would otherwise be left on a button beside a surface that has
    // just appeared; put it back where the text is. After the render, so
    // there is something focusable to put it on — and the scroll goes last,
    // because focusing scrolls the caret into view.
    afterNextRender(
      () => {
        if (view === 'rich') {
          this.editor?.focus();
        } else {
          const field = this.field();
          field?.focus();
          // Every write this control has had was a programmatic one — the
          // form's, or the document's — and each leaves the caret at the end
          // of the text, so focusing lands the reader at the bottom of what
          // they wrote. The start is where switching to the source means to
          // arrive; the scroll below then says where that is on the page.
          field?.setSelectionRange(0, 0);
        }
        scrollToRatio(this.surfaceFor(view), position);
      },
      { injector: this.injector }
    );
  }

  /** The element that scrolls in a given mode. */
  private surfaceFor(view: LgMarkdownView): HTMLElement | null {
    return view === 'rich'
      ? (this.editor?.scrollElement() ?? null)
      : this.field();
  }

  /**
   * Keeps the caret where it is when a toolbar button is pressed. The button
   * still takes focus from the keyboard, where Tab and Enter are the way in.
   */
  protected keepCaret(event: MouseEvent): void {
    event.preventDefault();
  }

  protected applyTableAction(action: LgTableAction): void {
    this.editor?.run(action);
  }

  protected applyTool(tool: LgMarkdownTool): void {
    if (this.richShowing()) {
      this.editor?.run(tool);
      if (tool === 'link') {
        // The row has just appeared holding a placeholder; the destination is
        // the one thing the author still has to say, so the caret goes there
        // rather than making them find it. After the render, since the row is
        // drawn from the state the command has only now changed.
        afterNextRender(
          () => {
            const input = this.linkInput()?.nativeElement;
            input?.focus();
            input?.select();
          },
          { injector: this.injector }
        );
      }
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
      tool,
      this.linkTextLabel()
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

  /**
   * The value as it stands, read from the control rather than from `value`:
   * the input is what a consumer last wrote, and typing has happened since.
   */
  private currentText(): string {
    return this.field()?.value ?? this.value();
  }

  /** The projected control, looked up per use rather than queried up front. */
  private field(): HTMLTextAreaElement | null {
    return this.host.nativeElement.querySelector('textarea');
  }
}

/**
 * How far through its scroll a surface is, from 0 to 1.
 *
 * A fraction rather than a pixel offset, and a rough one on purpose: the
 * document and its source are different lengths — a table is three lines of
 * pipes and one grid — so there is no offset that means the same thing in
 * both. What carries across is *roughly where in the text you were*, which is
 * what somebody switching modes to look at one paragraph actually wants. A
 * faithful answer would need the serializer to emit a source map, which it
 * does not.
 */
function scrollRatio(element: HTMLElement | null): number {
  if (!element) {
    return 0;
  }
  const range = element.scrollHeight - element.clientHeight;
  return range > 0 ? element.scrollTop / range : 0;
}

/** Puts a surface at the same fraction of its own scroll. */
function scrollToRatio(element: HTMLElement | null, ratio: number): void {
  if (!element) {
    return;
  }
  const range = element.scrollHeight - element.clientHeight;
  element.scrollTop = range > 0 ? Math.round(range * ratio) : 0;
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
  codeBlock: 'ph ph-code-block',
  divider: 'ph ph-minus',
  table: 'ph ph-table'
};

/**
 * The table row's icons. The two deletions name a row and a column rather
 * than an act — Phosphor has no minus twin for either — and carry the danger
 * severity, which is what says which way the button goes.
 */
const TABLE_ICONS: Record<LgTableAction, string> = {
  rowBefore: 'ph ph-rows-plus-top',
  rowAfter: 'ph ph-rows-plus-bottom',
  colBefore: 'ph ph-columns-plus-left',
  colAfter: 'ph ph-columns-plus-right',
  deleteRow: 'ph ph-rows',
  deleteCol: 'ph ph-columns',
  alignLeft: 'ph ph-text-align-left',
  alignCenter: 'ph ph-text-align-center',
  alignRight: 'ph ph-text-align-right',
  deleteTable: 'ph ph-trash'
};

const DESTRUCTIVE: ReadonlySet<LgTableAction> = new Set<LgTableAction>([
  'deleteRow',
  'deleteCol',
  'deleteTable'
]);

/** The three actions whose pressed state is the cell's current alignment. */
const ALIGNMENTS: Partial<Record<LgTableAction, 'left' | 'center' | 'right'>> =
  {
    alignLeft: 'left',
    alignCenter: 'center',
    alignRight: 'right'
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
