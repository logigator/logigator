import { Marked, type Token, type Tokens } from 'marked';
import { normalizeAuthoredText } from '@logigator/core';
import { TRANSLATED_DESCRIPTION_LENGTH } from '../database/schema/texts';

/**
 * Lexes the way `@logigator/ui` renders an authored field, so a construct the
 * renderer turns into a link or a code block is one this check sees as one.
 * An instance of its own rather than marked's module-global one, which a
 * `use()` anywhere in the process would reconfigure.
 */
const lexer = new Marked({ gfm: true, breaks: true });

/**
 * What a translated description may not change. The original is the author's
 * and the translation is shown under the author's name, while the text that
 * produced it is attacker-controlled input to the model, so this bounds what
 * the output can become whatever the prompt was made to do.
 *
 * Only structure is compared, never prose: code and destinations are what a
 * translation must carry over verbatim, and the shape of tables and headings
 * is what a faithful one keeps. Raw HTML is left out because the renderer
 * shows it as text.
 */
interface DescriptionShape {
  /** Fenced and indented blocks with their language, and inline code. */
  code: string[];
  /** Link and image destinations in document order, a bare URL included. */
  destinations: string[];
  /** Per table, the column count and then every row's cell count. */
  tables: number[][];
  headings: number;
}

function shapeOf(markdown: string): DescriptionShape {
  const shape: DescriptionShape = {
    code: [],
    destinations: [],
    tables: [],
    headings: 0
  };

  lexer.walkTokens(lexer.lexer(markdown), (token: Token) => {
    switch (token.type) {
      case 'code': {
        const { lang, text } = token as Tokens.Code;
        shape.code.push(`block:${lang ?? ''}:${text}`);
        break;
      }
      case 'codespan':
        shape.code.push(`inline:${(token as Tokens.Codespan).text}`);
        break;
      case 'link':
        shape.destinations.push(`link:${(token as Tokens.Link).href}`);
        break;
      case 'image':
        shape.destinations.push(`image:${(token as Tokens.Image).href}`);
        break;
      case 'table': {
        const { header, rows } = token as Tokens.Table;
        shape.tables.push([header.length, ...rows.map((row) => row.length)]);
        break;
      }
      case 'heading':
        shape.headings += 1;
        break;
    }
  });

  shape.code.sort();
  return shape;
}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * Whether a machine-translated description may stand in for the original.
 *
 * @returns why it is refused, phrased so the retry can name it to the model
 *   and the log can carry it — it describes the difference and quotes neither
 *   text — or `null` for a translation that passes.
 */
export function checkTranslatedDescription(
  original: string,
  translated: string
): string | null {
  const length = normalizeAuthoredText(translated).length;
  if (length > TRANSLATED_DESCRIPTION_LENGTH) {
    return `it is ${length} characters long, over the limit of ${TRANSLATED_DESCRIPTION_LENGTH}`;
  }

  const source = shapeOf(original);
  const target = shapeOf(translated);

  if (!same(source.code, target.code)) {
    return 'its code blocks or inline code differ from the original, which they must match character for character';
  }
  if (!same(source.destinations, target.destinations)) {
    return 'its link or image destinations differ from the original, which they must match exactly and in the same order';
  }
  if (!same(source.tables, target.tables)) {
    return 'its tables do not have the same rows and columns as the original';
  }
  if (source.headings !== target.headings) {
    return `it has ${target.headings} headings where the original has ${source.headings}`;
  }
  return null;
}
