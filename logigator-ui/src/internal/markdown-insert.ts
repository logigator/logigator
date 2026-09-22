/**
 * What a formatting button does to the text under the caret.
 *
 * Pure, and its own file, for the reason `markdown-urls.ts` is: the rule is
 * worth testing without a DOM, and what the editing surface then does with the
 * result — the browser's own `insertText`, or an assignment when that is
 * refused — is a separate question from what the result should be.
 */

/** The tools a field may offer, in the order a toolbar shows them. */
export type LgMarkdownTool =
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bold'
  | 'italic'
  | 'code'
  | 'link'
  | 'bulletedList'
  | 'numberedList'
  | 'quote'
  | 'codeBlock'
  | 'divider'
  | 'table';

/**
 * Presentation order, grouped the way the toolbar draws them: the block level
 * first, then the marks, then what a mark points at, then the block shapes.
 */
export const LG_MARKDOWN_TOOLS: readonly LgMarkdownTool[] = [
  'heading1',
  'heading2',
  'heading3',
  'bold',
  'italic',
  'code',
  'link',
  'bulletedList',
  'numberedList',
  'quote',
  'codeBlock',
  'divider',
  'table'
];

/** Where a group ends, so the toolbar can rule between them. */
export const LG_MARKDOWN_TOOL_GROUPS: readonly LgMarkdownTool[] = [
  'heading3',
  'code',
  'link',
  'numberedList'
];

/**
 * One edit: what replaces the range, and what should be selected afterwards.
 *
 * The two offsets are relative to the start of the replaced range, so a caller
 * adds its own `start` and never has to know how the replacement was built.
 */
export interface LgMarkdownEdit {
  /** Replaces everything between `start` and `end`. */
  replacement: string;
  /** Where the selection begins afterwards, from the start of the range. */
  selectFrom: number;
  /** Where it ends. Equal to `selectFrom` for a caret. */
  selectTo: number;
  /** The range actually replaced, which a line tool widens to whole lines. */
  start: number;
  end: number;
}

/** The marker each wrapping tool puts on both sides of its selection. */
const WRAPPERS: Partial<Record<LgMarkdownTool, string>> = {
  bold: '**',
  italic: '*',
  code: '`'
};

/** The prefix each line tool puts on every line it covers. */
const PREFIXES: Partial<Record<LgMarkdownTool, string>> = {
  heading1: '# ',
  heading2: '## ',
  heading3: '### ',
  bulletedList: '- ',
  numberedList: '1. ',
  quote: '> '
};

/**
 * Any heading marker at the start of a line. Headings are exclusive in a way
 * the other line tools are not: asking for an `##` on an `###` line means
 * *that* heading, not a sixth-level one, so the old marker comes off first.
 */
const ANY_HEADING = /^#{1,6} /;

/** The smallest table that is still a table, and reads as an example. */
const TABLE_SKELETON = '| Column | Column |\n| --- | --- |\n| Cell | Cell |\n';

/** The text a link tool leaves selected, so the next keystroke replaces it. */
const LINK_PLACEHOLDER = 'https://';

/** A fence, and the text a fence with nothing to wrap is given to hold. */
const CODE_FENCE = '```';
const CODE_PLACEHOLDER = 'code';

/**
 * The edit a tool makes to `value` over the range `[start, end)`.
 *
 * Every tool toggles. A second click on a bold selection unwraps it and a
 * second click on a list strips it, because a button that only ever adds is a
 * button whose only undo is the keyboard — and the state it would have to show
 * to be honest about that is state this has no way to compute for a caller.
 */
export function applyMarkdownTool(
  value: string,
  start: number,
  end: number,
  tool: LgMarkdownTool,
  /** The word a link with nothing selected is hung on, in the reader's own language. */
  linkText = 'link'
): LgMarkdownEdit {
  const wrapper = WRAPPERS[tool];
  if (wrapper) {
    return wrap(value, start, end, wrapper);
  }
  if (tool === 'link') {
    return link(value, start, end, linkText);
  }
  if (tool === 'divider') {
    // Nothing in a rule is worth replacing, so the caret lands after it and
    // writing carries on below.
    return block(value, start, end, '---\n', false);
  }
  if (tool === 'table') {
    return block(value, start, end, TABLE_SKELETON, true);
  }
  if (tool === 'codeBlock') {
    return fence(value, start, end);
  }
  return prefixLines(value, start, end, PREFIXES[tool] ?? '');
}

/**
 * Wraps the selection, or unwraps it when the markers are already there.
 *
 * The markers are looked for *outside* the selection as well as inside it:
 * double-clicking a bolded word selects the word, not the asterisks around it,
 * and a reader who then clicks bold means "stop shouting".
 */
function wrap(
  value: string,
  start: number,
  end: number,
  marker: string
): LgMarkdownEdit {
  const selected = value.slice(start, end);
  const width = marker.length;

  if (
    selected.startsWith(marker) &&
    selected.endsWith(marker) &&
    selected.length >= width * 2
  ) {
    const inner = selected.slice(width, -width);
    return {
      replacement: inner,
      selectFrom: 0,
      selectTo: inner.length,
      start,
      end
    };
  }

  const before = value.slice(Math.max(0, start - width), start);
  const after = value.slice(end, end + width);
  if (before === marker && after === marker) {
    return {
      replacement: selected,
      selectFrom: 0,
      selectTo: selected.length,
      start: start - width,
      end: end + width
    };
  }

  return {
    replacement: `${marker}${selected}${marker}`,
    // The text, not the markers: typing replaces what was selected, and a
    // caret with nothing selected lands between them ready to type.
    selectFrom: width,
    selectTo: width + selected.length,
    start,
    end
  };
}

/**
 * A link around the selection, with the destination left selected.
 *
 * No prompt: the placeholder is selected, so typing replaces it and the next
 * Tab or click leaves a link that is at least well-formed. A dialog here would
 * mean the field taking a dialog service, which is a dependency a text control
 * should not have.
 */
function link(
  value: string,
  start: number,
  end: number,
  linkText: string
): LgMarkdownEdit {
  const selected = value.slice(start, end);
  const label = selected || linkText;
  const replacement = `[${label}](${LINK_PLACEHOLDER})`;
  const from = label.length + 3;
  return {
    replacement,
    selectFrom: from,
    selectTo: from + LINK_PLACEHOLDER.length,
    start,
    end
  };
}

/**
 * Fences the lines the range touches, or unfences them when they already are.
 *
 * Whole lines, like every other block tool: a fence is a property of the lines
 * it wraps and not of the words inside one. A fence may interrupt a paragraph
 * in CommonMark, so unlike a table it needs no blank line to separate it from
 * what is above.
 */
function fence(value: string, start: number, end: number): LgMarkdownEdit {
  const from = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEnd = value.indexOf('\n', end);
  const to = lineEnd === -1 ? value.length : lineEnd;

  const lines = value.slice(from, to).split('\n');
  const fenced =
    lines.length >= 2 &&
    lines[0]!.startsWith(CODE_FENCE) &&
    lines[lines.length - 1]!.trim() === CODE_FENCE;

  if (fenced) {
    const inner = lines.slice(1, -1).join('\n');
    return {
      replacement: inner,
      selectFrom: 0,
      selectTo: inner.length,
      start: from,
      end: to
    };
  }

  // A fence around nothing is a fence around a word to type over, the same
  // bargain the table skeleton strikes.
  const body = lines.join('\n') || CODE_PLACEHOLDER;
  const opening = CODE_FENCE.length + 1;
  return {
    replacement: `${CODE_FENCE}\n${body}\n${CODE_FENCE}`,
    selectFrom: opening,
    selectTo: opening + body.length,
    start: from,
    end: to
  };
}

/**
 * Puts `prefix` on every line the range touches, or takes it off every line
 * when all of them already carry it.
 *
 * The range is widened to whole lines first: a line tool is about lines, and a
 * caret in the middle of one means that line. A numbered list writes `1.` on
 * each line rather than counting, marked renumbering an ordered list from its
 * first item anyway.
 */
function prefixLines(
  value: string,
  start: number,
  end: number,
  prefix: string
): LgMarkdownEdit {
  const from = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEnd = value.indexOf('\n', end);
  const to = lineEnd === -1 ? value.length : lineEnd;

  const heading = prefix.startsWith('#');
  const lines = value.slice(from, to).split('\n');
  const stripping = lines.every((line) => line.startsWith(prefix));
  const replacement = lines
    .map((line) => {
      if (stripping) {
        return line.slice(prefix.length);
      }
      // A heading replaces whatever heading was there; a list or a quote
      // nests, which is why only this branch strips before it adds.
      const bare = heading ? line.replace(ANY_HEADING, '') : line;
      return `${prefix}${bare}`;
    })
    .join('\n');

  return {
    replacement,
    selectFrom: 0,
    selectTo: replacement.length,
    start: from,
    end: to
  };
}

/**
 * Puts a whole block on its own lines after the caret's line, with a blank
 * line around it.
 *
 * A divider and a table are not marks on the text under the caret — they are
 * new things placed near it — so a selection is kept rather than replaced,
 * and the block lands after the line the caret is on. The blank line matters:
 * markdown needs one before a table, and without it the table becomes part of
 * the paragraph above.
 *
 * `select` is for a block with placeholder text in it: a table's example cells
 * are there to be typed over, a rule's three dashes are not.
 */
function block(
  value: string,
  start: number,
  end: number,
  content: string,
  select: boolean
): LgMarkdownEdit {
  const lineEnd = value.indexOf('\n', end);
  const at = lineEnd === -1 ? value.length : lineEnd;
  const before = at === 0 || value.slice(0, at).endsWith('\n\n') ? '' : '\n\n';
  const after = value.slice(at).startsWith('\n') ? '' : '\n';
  const replacement = `${before}${content}${after}`;

  const to = before.length + content.length;
  return {
    replacement,
    // The block itself where it is an example to type over, otherwise a caret
    // just past it.
    selectFrom: select ? before.length : to,
    selectTo: to,
    start: at,
    end: at
  };
}
