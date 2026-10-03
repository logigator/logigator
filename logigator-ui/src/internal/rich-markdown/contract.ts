import type { LgMarkdownTool } from '../markdown-insert';

/**
 * What the rich editor is, as far as anything that is not the rich editor is
 * concerned.
 *
 * Every Milkdown import lives in `./editor`, which is reached through a
 * dynamic `import()` and nothing else. This file is the half the field needs
 * while that chunk is still on the network — or never fetched at all, on the
 * server and wherever the load fails — so it holds the vocabulary and the
 * types and imports nothing that costs bytes.
 */

/**
 * What the second toolbar row does to the table the caret is in.
 *
 * Tables are the one shape with no useful caret-level gesture: every other
 * tool answers "what is this text", and these answer "what is this grid",
 * which needs a row of its own that is only there while there is a grid.
 */
export type LgTableAction =
  | 'rowBefore'
  | 'rowAfter'
  | 'colBefore'
  | 'colAfter'
  | 'deleteRow'
  | 'deleteCol'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'deleteTable';

/** Presentation order: add, remove, align, and the destructive one last. */
export const LG_TABLE_ACTIONS: readonly LgTableAction[] = [
  'rowBefore',
  'rowAfter',
  'colBefore',
  'colAfter',
  'deleteRow',
  'deleteCol',
  'alignLeft',
  'alignCenter',
  'alignRight',
  'deleteTable'
];

/** Where a rule follows, the way the format toolbar separates its groups. */
export const LG_TABLE_ACTION_GROUPS: readonly LgTableAction[] = [
  'colAfter',
  'deleteCol',
  'alignRight'
];

/** Column alignment, as GFM's delimiter row can express it. */
export type LgTableAlign = 'left' | 'center' | 'right';

/**
 * What the toolbar draws itself from: what is switched on where the caret is.
 *
 * It is a snapshot rather than a live handle, so a button's pressed state is
 * a signal the field sets and not a read the template performs — the editor
 * is outside Angular, and a template that asked it questions would be asking
 * them on every change detection run.
 */
export interface LgRichState {
  /** The tools that are on at the selection; `bold` inside `**…**`. */
  readonly active: readonly LgMarkdownTool[];
  /** Whether the second row applies at all. */
  readonly inTable: boolean;
  /** The current cell's column alignment, `undefined` outside a table. */
  readonly align: LgTableAlign | undefined;
  /**
   * The destination of the link the caret is in, `undefined` where there is
   * none. It is what the link row shows and edits — a link's text is in the
   * document and typed there, its destination is not anywhere a caret can
   * reach.
   */
  readonly link: string | undefined;
}

/** Nothing is on, which is what the toolbar shows before the chunk lands. */
export const LG_RICH_STATE_EMPTY: LgRichState = {
  active: [],
  inTable: false,
  align: undefined,
  link: undefined
};

/** How the editor is built, and where its two outputs go. */
export interface LgRichEditorOptions {
  /** The element the editor takes over. Emptied on `destroy`. */
  readonly root: HTMLElement;
  /** The markdown to start from. */
  readonly value: string;
  /** Whether typing is allowed; a disabled control still shows its text. */
  readonly editable: () => boolean;
  /**
   * The chrome the surface wears, read live.
   *
   * It is the **same** `formFieldClasses` the projected textarea wears, so the
   * box an author types into is the box they saw a moment ago in the other
   * mode — border, background, radius, padding and the focus colour all from
   * one definition. A getter rather than a string because the invalid state
   * changes while the field is open; {@link LgRichEditor.refresh} is what
   * makes the view read it again.
   */
  readonly surfaceClass: () => string;
  /** The word a link made with nothing selected is hung on, localized. */
  readonly linkText: string;
  /** Names the field's `<label>`, the projected textarea being hidden. */
  readonly labelledBy?: string;
  /** Names the hint or error `lg-form-field` is showing. */
  readonly describedBy?: string;
  /**
   * The document changed, as markdown.
   *
   * **Only ever fired for an edit the author made.** Seeding the editor and
   * `setValue` both go through the same replace-everything transaction, and
   * neither reports — which is the whole of the rule that a document nobody
   * touched is never written back in a serializer's spelling rather than its
   * author's.
   */
  readonly onChange: (markdown: string) => void;
  /** The selection or the document moved; the toolbar redraws from this. */
  readonly onStateChange: (state: LgRichState) => void;
}

/** The handle the field keeps. */
export interface LgRichEditor {
  /** Runs a toolbar action against the current selection. */
  run(action: LgMarkdownTool | LgTableAction): void;
  /** Points the link the caret is in at `href`, leaving its text alone. */
  setLink(href: string): void;
  /** Takes the link off, keeping the words that carried it. */
  removeLink(): void;
  /**
   * Replaces the document, without reporting the change. For a write that
   * came from outside — a consumer resetting the form, a save putting the
   * trimmed value back.
   */
  setValue(markdown: string): void;
  /**
   * Re-reads `surfaceClass` and `editable`.
   *
   * Both are passed as getters and ProseMirror consults them when it updates,
   * which a change to neither one causes on its own.
   */
  refresh(): void;
  /**
   * The element the document scrolls inside, so a mode switch can carry a
   * reading position from one surface to the other.
   */
  scrollElement(): HTMLElement;
  focus(): void;
  destroy(): void;
}
