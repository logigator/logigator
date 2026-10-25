import { describe, expect, it } from 'vitest';
import { applyMarkdownTool, type LgMarkdownTool } from './markdown-insert';

/**
 * Applies a tool the way the field does and returns the resulting text with
 * the selection marked by `|`, which is what a caller actually cares about:
 * the string, and where the caret lands in it.
 */
function apply(
  before: string,
  tool: LgMarkdownTool,
  { at }: { at?: [number, number] } = {}
): string {
  const [start, end] = at ?? [before.indexOf('['), before.indexOf(']') - 1];
  const source = at ? before : before.replace('[', '').replace(']', '');
  const edit = applyMarkdownTool(source, start, end, tool);
  const next =
    source.slice(0, edit.start) + edit.replacement + source.slice(edit.end);
  const from = edit.start + edit.selectFrom;
  const to = edit.start + edit.selectTo;
  return `${next.slice(0, from)}|${next.slice(from, to)}|${next.slice(to)}`;
}

describe('applyMarkdownTool', () => {
  describe('the wrapping tools', () => {
    it('wraps a selection and keeps the words selected', () => {
      expect(apply('a [word] here', 'bold')).toBe('a **|word|** here');
      expect(apply('a [word] here', 'italic')).toBe('a *|word|* here');
      expect(apply('a [word] here', 'code')).toBe('a `|word|` here');
    });

    it('leaves the caret between the markers when nothing is selected', () => {
      // Typing then lands inside the emphasis rather than after it.
      expect(apply('ab', 'bold', { at: [1, 1] })).toBe('a**||**b');
    });

    it('unwraps a selection that already carries the markers', () => {
      expect(apply('a [**word**] here', 'bold')).toBe('a |word| here');
    });

    it('unwraps when the markers sit outside the selection', () => {
      // Double-clicking a bolded word selects the word, not the asterisks;
      // clicking bold then has to mean the same thing either way.
      const source = 'a **word** here';
      const at: [number, number] = [
        source.indexOf('word'),
        source.indexOf('word') + 4
      ];
      expect(apply(source, 'bold', { at })).toBe('a |word| here');
    });

    it('does not read an italic marker as half a bold one', () => {
      expect(apply('a [*word*] here', 'bold')).toBe('a **|*word*|** here');
    });
  });

  describe('the link tool', () => {
    it('keeps the selection as the label and selects the destination', () => {
      expect(apply('see [docs] now', 'link')).toBe(
        'see [docs](|https://|) now'
      );
    });

    it('writes a placeholder label when nothing is selected', () => {
      expect(apply('x', 'link', { at: [1, 1] })).toBe('x[link](|https://|)');
    });
  });

  describe('the heading tools', () => {
    it('replaces a heading rather than stacking another marker on it', () => {
      // `##` on an `###` line means that heading, not a sixth-level one.
      expect(apply('### deep', 'heading1', { at: [0, 0] })).toBe('|# deep|');
      expect(apply('# top', 'heading3', { at: [0, 0] })).toBe('|### top|');
    });

    it('removes the heading when the same level is asked for twice', () => {
      expect(apply('## x', 'heading2', { at: [0, 0] })).toBe('|x|');
    });

    it('leaves a list marker alone — only headings are exclusive', () => {
      expect(apply('- item', 'quote', { at: [0, 0] })).toBe('|> - item|');
    });
  });

  describe('the block tools', () => {
    it('puts a divider on its own lines and leaves the caret past it', () => {
      // Nothing in three dashes is worth selecting; writing carries on below.
      expect(apply('one', 'divider', { at: [1, 1] })).toBe('one\n\n---\n||\n');
    });

    it('puts a table after the caret with its example text selected', () => {
      const out = apply('intro', 'table', { at: [2, 2] });
      expect(out).toContain('| Column | Column |');
      expect(out).toContain('| --- | --- |');
      // The skeleton is selected, so the next keystroke replaces it.
      expect(out).toMatch(/\|\| Column/);
    });

    it('does not double a blank line that is already there', () => {
      expect(apply('one\n\n', 'divider', { at: [3, 3] })).not.toContain(
        '\n\n\n'
      );
    });

    it('keeps the selection rather than replacing it', () => {
      // A divider is a new thing near the text, not a mark on it.
      expect(apply('keep me', 'divider', { at: [0, 7] })).toContain('keep me');
    });
  });

  describe('the line tools', () => {
    it('prefixes the line the caret is on, wherever in it the caret sits', () => {
      expect(apply('one\ntwo', 'bulletedList', { at: [5, 5] })).toBe(
        'one\n|- two|'
      );
    });

    it('prefixes every line a selection touches', () => {
      const source = 'one\ntwo\nthree';
      expect(apply(source, 'quote', { at: [1, 9] })).toBe(
        '|> one\n> two\n> three|'
      );
    });

    it('strips when every covered line already carries the prefix', () => {
      const source = '- one\n- two';
      expect(apply(source, 'bulletedList', { at: [0, source.length] })).toBe(
        '|one\ntwo|'
      );
    });

    it('adds when only some of the lines carry it', () => {
      const source = '- one\ntwo';
      expect(apply(source, 'bulletedList', { at: [0, source.length] })).toBe(
        '|- - one\n- two|'
      );
    });

    it('writes 1. on every line and lets the renderer number them', () => {
      expect(apply('one\ntwo', 'numberedList', { at: [0, 7] })).toBe(
        '|1. one\n1. two|'
      );
    });

    it('handles the first and last line of the value', () => {
      expect(apply('only', 'quote', { at: [0, 0] })).toBe('|> only|');
      expect(apply('', 'quote', { at: [0, 0] })).toBe('|> |');
    });
  });
});
