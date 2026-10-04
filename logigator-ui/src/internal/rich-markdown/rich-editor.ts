import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  editorViewOptionsCtx,
  remarkStringifyOptionsCtx,
  rootCtx,
  serializerCtx
} from '@milkdown/kit/core';
import {
  commonmark,
  createCodeBlockCommand,
  headingAttr,
  remarkPreserveEmptyLinePlugin,
  liftListItemCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
  toggleStrongCommand,
  turnIntoTextCommand,
  updateLinkCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
  insertHrCommand
} from '@milkdown/kit/preset/commonmark';
import {
  addColAfterCommand,
  addColBeforeCommand,
  addRowAfterCommand,
  addRowBeforeCommand,
  gfm,
  insertTableCommand
} from '@milkdown/kit/preset/gfm';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { cursor } from '@milkdown/kit/plugin/cursor';
import { history } from '@milkdown/kit/plugin/history';
import { trailing } from '@milkdown/kit/plugin/trailing';
import { lift } from '@milkdown/kit/prose/commands';
import {
  Plugin,
  TextSelection,
  type Command,
  type EditorState
} from '@milkdown/kit/prose/state';
import {
  deleteColumn,
  deleteRow,
  deleteTable,
  isInTable,
  selectedRect
} from '@milkdown/kit/prose/tables';
import { $prose, callCommand, replaceAll } from '@milkdown/kit/utils';

import type { LgMarkdownTool } from '../markdown-insert';
import {
  type LgRichEditor,
  type LgRichEditorOptions,
  type LgRichState,
  type LgTableAction,
  type LgTableAlign
} from './contract';

/**
 * The rich editor: Milkdown over ProseMirror, wrapped so that nothing outside
 * this file imports either.
 *
 * It is reached through one dynamic `import()`, which is the whole reason the
 * wrapper is a plain function and not an Angular component — a chunk holding a
 * decorator would drag the compiler's output for it along, and there is
 * nothing here that needs a template. The field owns the DOM node; this owns
 * what happens inside it.
 *
 * **Markdown is the value, not the model.** The document is ProseMirror's
 * while it is being edited, and the field's projected `<textarea>` stays the
 * control — every edit is serialized straight back into it. So the form, the
 * counter, the validator and the source view all keep reading the one string
 * they already read, and switching to source is showing an element that was
 * never out of date rather than a conversion.
 */

/**
 * How the serializer spells what it writes.
 *
 * Two different jobs, and it matters which is which.
 *
 * **What is re-spelled.** A list's bullet and a rule are properties of the
 * document, not of the mark, so they are written in whatever this says on
 * every serialization — remark's own defaults are `*` and `***`, which would
 * re-spell every list in a description the first time one word of it was
 * touched. These are set to what the source toolbar has always written, so
 * the only documents the two halves disagree about are ones pasted in from
 * somewhere else.
 *
 * **What is not.** Milkdown carries each inline mark's own marker on the mark
 * and seeds its default from here, so `emphasis` and `strong` decide how a
 * *newly applied* italic or bold is written and leave the ones already in the
 * document exactly as their author typed them. That is the property that
 * makes editing one paragraph safe for the paragraphs beside it, and the
 * reason this editor was the one worth building on.
 *
 * `strong: '*'` is the marker, doubled by the writer: `**bold**`.
 */
const STRINGIFY_OPTIONS = {
  bullet: '-',
  emphasis: '*',
  strong: '*',
  rule: '-',
  ruleRepetition: 3,
  ruleSpaces: false,
  fences: true
} as const;

/**
 * The document as the string that will be stored.
 *
 * remark ends every document with a newline, which nothing here wants: the
 * value is trimmed by `normalizeAuthoredText` before it is stored, and a
 * counter that showed one character more than the column will hold would be
 * counting the serializer's punctuation rather than the author's text.
 */
function serialize(
  serializer: (doc: EditorState['doc']) => string,
  state: EditorState
): string {
  return serializer(state.doc).replace(/\n+$/, '');
}

/**
 * The preset, minus the one plugin that writes markup into the markdown.
 *
 * `remark-preserve-empty-line` keeps a blank paragraph across a round trip by
 * serializing it as a literal `<br />`. Nothing else in this field may put
 * markup in the value: the renderer that draws a description produces no HTML
 * an author wrote, so a `<br />` reaches the reader as those six characters.
 * A blank line is not worth a visible tag, so the plugin comes out — and with
 * it, an empty paragraph serializes to nothing, which is what it means.
 */
const COMMONMARK = commonmark.filter(
  (plugin) => !remarkPreserveEmptyLinePlugin.includes(plugin)
);

/** The smallest table that is still one, matching what the source tool inserts. */
const TABLE_SIZE = { row: 3, col: 2 } as const;

/** What a link tool leaves in place for the author to replace. */
const LINK_PLACEHOLDER = 'https://';

export async function createRichEditor(
  options: LgRichEditorOptions
): Promise<LgRichEditor> {
  /**
   * Suppresses `onChange` for a write that did not come from the author.
   * Seeding and `setValue` both replace the whole document, and a report from
   * either would put the serializer's spelling into a control the author has
   * not touched — the one thing this design has to not do.
   */
  let programmatic = true;

  /**
   * The one place an edit is noticed.
   *
   * `@milkdown/plugin-listener` would do this, and **debounces its callback
   * by 200ms** — so a Save clicked straight after the last keystroke would
   * submit the value from before it. What the form holds has to be what the
   * document holds, with no window in between, so the serializer is called
   * here instead and the plugin is not used at all.
   */
  const watcher = $prose(
    (ctx) =>
      new Plugin({
        view: () => ({
          update: (view, previous) => {
            const edited = !view.state.doc.eq(previous.doc);
            if (edited && !programmatic) {
              options.onChange(serialize(ctx.get(serializerCtx), view.state));
            }
            // Redrawn for a moved caret as much as for an edit: what the
            // toolbar shows is a property of the selection.
            if (edited || !view.state.selection.eq(previous.selection)) {
              options.onStateChange(readState(view.state));
            }
          }
        })
      })
  );

  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, options.root);
      ctx.set(defaultValueCtx, options.value);
      ctx.update(remarkStringifyOptionsCtx, (previous) => ({
        ...previous,
        ...STRINGIFY_OPTIONS
      }));
      // The level that was written, as an attribute, because that is what the
      // shared stylesheet sizes a member's headings by: the page's renderer
      // moves the tags two levels down so a description cannot put an `h1` on
      // somebody else's page, and this one numbers them from one — so the tag
      // is no longer the thing the two have in common.
      ctx.set(headingAttr.key, (node) => ({
        'data-level': String(node.attrs['level'])
      }));
      ctx.update(editorViewOptionsCtx, (previous) => ({
        ...previous,
        editable: options.editable,
        // A function, so the invalid border can come and go while the field
        // is open: ProseMirror calls it on every update it makes.
        attributes: () => ({
          // `lg-prose` is the class the page's own renderer puts on itself —
          // one stylesheet draws the document here and there, so editing in
          // place shows what will actually be published — and the rest is the
          // same chrome the projected textarea wears.
          class: `lg-rich-surface lg-prose ${options.surfaceClass()}`,
          // This field is where a member writes a description or a bio and
          // nothing else, so the prose in it is drawn under the same rule the
          // page will draw it under.
          'data-user-content': 'true',
          // The projected textarea carries the id the `<label>` points at and
          // is invisible while this is showing, so the name has to be repeated
          // here or the control has none.
          role: 'textbox',
          'aria-multiline': 'true',
          ...(options.labelledBy
            ? { 'aria-labelledby': options.labelledBy }
            : {}),
          ...(options.describedBy
            ? { 'aria-describedby': options.describedBy }
            : {})
        })
      }));
    })
    .use(COMMONMARK)
    .use(gfm)
    .use(history)
    .use(clipboard)
    .use(cursor)
    .use(trailing)
    .use(watcher)
    .create();

  programmatic = false;

  const view = () => editor.ctx.get(editorViewCtx);

  /** Runs a bare ProseMirror command, for the ones Milkdown does not wrap. */
  const runProse = (command: Command): void => {
    const current = view();
    command(current.state, current.dispatch, current);
  };

  const editorHandle: LgRichEditor = {
    run(action) {
      const current = view();
      if (!current.editable) {
        return;
      }
      const state = readState(current.state);
      if (isTableAction(action)) {
        runTableAction(action, runProse, editor);
      } else {
        runTool(action, state, runProse, editor, options.linkText);
      }
      current.focus();
    },
    refresh() {
      // Merging nothing is how a view is made to re-read the props it was
      // given as functions; there is no narrower hook for it.
      view().setProps({});
    },
    setLink(href) {
      editor.action(callCommand(updateLinkCommand.key, { href }));
    },
    removeLink() {
      editor.action(callCommand(toggleLinkCommand.key));
    },
    setValue(markdown) {
      programmatic = true;
      try {
        editor.action(replaceAll(markdown));
      } finally {
        programmatic = false;
      }
    },
    scrollElement() {
      // ProseMirror's editable element is the one the styles give a height
      // and an overflow to, so it is also the one that scrolls.
      return view().dom as HTMLElement;
    },
    focus() {
      view().focus();
    },
    destroy() {
      void editor.destroy(true);
    }
  };

  // The first read: the toolbar is drawn before anything has moved.
  options.onStateChange(readState(view().state));

  return editorHandle;
}

function isTableAction(
  action: LgMarkdownTool | LgTableAction
): action is LgTableAction {
  return TABLE_ACTIONS.has(action as LgTableAction);
}

const TABLE_ACTIONS = new Set<LgTableAction>([
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
]);

/**
 * One formatting tool.
 *
 * Every one of them toggles, because the toolbar now shows which are on: a
 * pressed button that only ever adds would be lying about what a second press
 * does. `state` is what decides, which is the same snapshot the button drew
 * itself from.
 */
function runTool(
  tool: LgMarkdownTool,
  state: LgRichState,
  runProse: (command: Command) => void,
  editor: Editor,
  linkText: string
): void {
  const on = (candidate: LgMarkdownTool) => state.active.includes(candidate);
  const call = (key: Parameters<typeof callCommand>[0], payload?: unknown) => {
    editor.action(callCommand(key, payload));
  };

  switch (tool) {
    case 'bold':
      return call(toggleStrongCommand.key);
    case 'italic':
      return call(toggleEmphasisCommand.key);
    case 'code':
      return call(toggleInlineCodeCommand.key);
    case 'link':
      // No prompt: the mark goes on with a placeholder destination and the
      // link row below is where it is then typed. A dialog here would mean
      // the field taking a dialog service, which a text control should not
      // have.
      return on('link')
        ? call(toggleLinkCommand.key)
        : runProse(applyLink(LINK_PLACEHOLDER, linkText));
    case 'heading1':
    case 'heading2':
    case 'heading3': {
      const level = Number(tool.slice(-1));
      // A level below one is how this command spells "back to a paragraph",
      // which is what a second press on the heading you are already in means.
      return call(wrapInHeadingCommand.key, on(tool) ? 0 : level);
    }
    case 'bulletedList':
      return on('bulletedList')
        ? call(liftListItemCommand.key)
        : call(wrapInBulletListCommand.key);
    case 'numberedList':
      return on('numberedList')
        ? call(liftListItemCommand.key)
        : call(wrapInOrderedListCommand.key);
    case 'quote':
      // Milkdown wraps but does not unwrap; lifting out is ProseMirror's own.
      return on('quote') ? runProse(lift) : call(wrapInBlockquoteCommand.key);
    case 'codeBlock':
      return on('codeBlock')
        ? call(turnIntoTextCommand.key)
        : call(createCodeBlockCommand.key);
    case 'divider':
      return call(insertHrCommand.key);
    case 'table':
      return call(insertTableCommand.key, TABLE_SIZE);
  }
}

function runTableAction(
  action: LgTableAction,
  runProse: (command: Command) => void,
  editor: Editor
): void {
  const call = (key: Parameters<typeof callCommand>[0], payload?: unknown) => {
    editor.action(callCommand(key, payload));
  };

  switch (action) {
    case 'rowBefore':
      return call(addRowBeforeCommand.key);
    case 'rowAfter':
      return call(addRowAfterCommand.key);
    case 'colBefore':
      return call(addColBeforeCommand.key);
    case 'colAfter':
      return call(addColAfterCommand.key);
    // The deletions are prosemirror-tables' own: Milkdown's one command
    // decides between a row and a column from the selection, and these two
    // buttons have already been told which.
    case 'deleteRow':
      return runProse(deleteRow);
    case 'deleteCol':
      return runProse(deleteColumn);
    case 'deleteTable':
      return runProse(deleteTable);
    case 'alignLeft':
      return runProse(alignColumn('left'));
    case 'alignCenter':
      return runProse(alignColumn('center'));
    case 'alignRight':
      return runProse(alignColumn('right'));
  }
}

/**
 * Puts a link on the selection, or makes one where nothing is selected.
 *
 * `toggleMark` on a collapsed caret only records a stored mark: nothing
 * becomes a link, nothing appears on the page and the button looks broken,
 * which is what it did. A word to hang the mark on is the same bargain the
 * source view strikes with `[link](https://)`, and it leaves that word
 * selected so the next keystroke replaces it. The word itself is the
 * consumer's, in the reader's own language.
 */
function applyLink(href: string, label: string): Command {
  return (state, dispatch) => {
    const type = state.schema.marks['link'];
    if (!type) {
      return false;
    }
    if (dispatch) {
      const { from, to, empty } = state.selection;
      const tr = state.tr;
      if (empty) {
        const end = from + label.length;
        tr.insertText(label, from);
        tr.addMark(from, end, type.create({ href }));
        tr.setSelection(TextSelection.create(tr.doc, from, end));
      } else {
        tr.addMark(from, to, type.create({ href }));
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/**
 * Aligns the whole column the selection is in.
 *
 * Not `setAlignCommand`, which writes the attribute onto the selected cells
 * and no others. GFM has no per-cell alignment — the delimiter row aligns a
 * column — so the serializer reads the attribute off the **header row alone**,
 * and a plugin syncs every body cell back to its header. Between the two, an
 * alignment set on a body cell was overwritten before it could be written out
 * and the button did nothing at all, which is exactly how it behaved.
 *
 * Every cell in the column is set, header included: the header is what is
 * serialized, and the body cells are what the reader sees move.
 */
function alignColumn(alignment: LgTableAlign): Command {
  return (state, dispatch) => {
    if (!isInTable(state)) {
      return false;
    }
    if (!dispatch) {
      return true;
    }
    const rect = selectedRect(state);
    const tr = state.tr;
    // A cell spanning rows or columns is named by its map more than once.
    const seen = new Set<number>();
    for (let row = 0; row < rect.map.height; row++) {
      for (let col = rect.left; col < rect.right; col++) {
        const pos = rect.map.positionAt(row, col, rect.table);
        if (seen.has(pos)) {
          continue;
        }
        seen.add(pos);
        const cell = rect.table.nodeAt(pos);
        if (cell) {
          tr.setNodeMarkup(rect.tableStart + pos, undefined, {
            ...cell.attrs,
            alignment
          });
        }
      }
    }
    if (tr.docChanged) {
      dispatch(tr);
    }
    return true;
  };
}

/** Marks and blocks the schema names, as the toolbar's own vocabulary. */
const BLOCK_TOOLS: Readonly<Record<string, LgMarkdownTool>> = {
  code_block: 'codeBlock',
  bullet_list: 'bulletedList',
  ordered_list: 'numberedList',
  blockquote: 'quote',
  table: 'table'
};

const MARK_TOOLS: Readonly<Record<string, LgMarkdownTool>> = {
  strong: 'bold',
  emphasis: 'italic',
  inlineCode: 'code',
  link: 'link'
};

const CELL_NODES: ReadonlySet<string> = new Set(['table_cell', 'table_header']);

const ALIGNMENTS: ReadonlySet<string> = new Set(['left', 'center', 'right']);

/**
 * What is switched on where the caret is.
 *
 * A mark is read from the stored marks for a caret and from the range for a
 * selection: `storedMarks` is what the *next* keystroke would carry, which is
 * what a caret sitting just after a bold word means, and a range that is only
 * partly bold is not bold.
 */
export function readState(state: EditorState): LgRichState {
  const { $from, from, to, empty } = state.selection;
  const active = new Set<LgMarkdownTool>();

  const marks = empty ? (state.storedMarks ?? $from.marks()) : undefined;
  for (const [name, tool] of Object.entries(MARK_TOOLS)) {
    const type = state.schema.marks[name];
    if (!type) {
      continue;
    }
    const on = marks
      ? Boolean(type.isInSet(marks))
      : state.doc.rangeHasMark(from, to, type);
    if (on) {
      active.add(tool);
    }
  }

  let inTable = false;
  let align: LgTableAlign | undefined;
  const link = linkAt(state);

  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    const name = node.type.name;

    if (name === 'heading') {
      const level = node.attrs['level'];
      if (level === 1 || level === 2 || level === 3) {
        active.add(`heading${level}` as LgMarkdownTool);
      }
      continue;
    }
    if (CELL_NODES.has(name)) {
      const alignment = node.attrs['alignment'];
      align =
        typeof alignment === 'string' && ALIGNMENTS.has(alignment)
          ? (alignment as LgTableAlign)
          : undefined;
      continue;
    }
    const tool = BLOCK_TOOLS[name];
    if (tool) {
      active.add(tool);
      if (tool === 'table') {
        inTable = true;
      }
    }
  }

  return {
    active: [...active],
    inTable,
    align: inTable ? align : undefined,
    link
  };
}

/**
 * The destination of the link the selection sits in.
 *
 * The same walk `updateLinkCommand` makes, so the row that shows a
 * destination and the command that rewrites it are looking at the same mark:
 * one position wide for a caret, because a caret between two characters is
 * inside the link they belong to.
 */
function linkAt(state: EditorState): string | undefined {
  const type = state.schema.marks['link'];
  if (!type) {
    return undefined;
  }
  const { from, to } = state.selection;
  let href: string | undefined;
  state.doc.nodesBetween(from, from === to ? to + 1 : to, (node) => {
    if (href !== undefined) {
      return false;
    }
    const mark = type.isInSet(node.marks);
    if (mark) {
      const value = mark.attrs['href'];
      href = typeof value === 'string' ? value : '';
      return false;
    }
    return true;
  });
  return href;
}
