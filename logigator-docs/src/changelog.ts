/**
 * The changelog, as data: the release headings the editor's dialog only ever
 * renders as prose, so the website can draw one block per release, its feed
 * can carry one entry per release, and a release can quote its own notes.
 *
 * The documents follow Keep a Changelog 1.1: English is the repository's
 * `CHANGELOG.md`, the translations are `changelog/<lang>.md`, and each app
 * imports them through its own loader, as it does every page here.
 */

/** What an entry does to the product, one `### …` section of a release each. */
export type ChangeKind = 'added' | 'changed' | 'removed' | 'fixed' | 'security';

/** The kinds in the order a release lists their sections. */
export const CHANGE_KINDS: readonly ChangeKind[] = [
  'added',
  'changed',
  'removed',
  'fixed',
  'security'
];

/**
 * The emoji each kind's heading opens with, the same in every language, so
 * the sections look alike in every release wherever the markdown is read.
 */
export const CHANGE_EMOJI: Readonly<Record<ChangeKind, string>> = {
  added: '✨',
  changed: '🔄',
  removed: '🗑️',
  fixed: '🐛',
  security: '🔒'
};

/**
 * Each language's name for every kind, which are Keep a Changelog's own
 * translations; a heading is `### <emoji> <name>`. A document in a language
 * missing here cannot be parsed.
 */
export const CHANGE_SECTION_TITLES: Readonly<
  Record<string, Readonly<Record<ChangeKind, string>>>
> = {
  en: {
    added: 'Added',
    changed: 'Changed',
    removed: 'Removed',
    fixed: 'Fixed',
    security: 'Security'
  },
  de: {
    added: 'Hinzugefügt',
    changed: 'Geändert',
    removed: 'Entfernt',
    fixed: 'Behoben',
    security: 'Sicherheit'
  },
  fr: {
    added: 'Ajouté',
    changed: 'Modifié',
    removed: 'Supprimé',
    fixed: 'Corrigé',
    security: 'Sécurité'
  },
  es: {
    added: 'Añadido',
    changed: 'Cambiado',
    removed: 'Eliminado',
    fixed: 'Arreglado',
    security: 'Seguridad'
  }
};

/** One `### …` section of a release. */
export interface ChangelogSection {
  kind: ChangeKind;
  /** The entries below the section heading, markdown. */
  body: string;
}

/** The notes below a `## …` heading. */
export interface ChangelogNotes {
  /** Everything below the heading, markdown: an optional lead, then `### …`. */
  body: string;
  /** The sections of {@link body}, in the order of {@link CHANGE_KINDS}. */
  sections: ChangelogSection[];
}

/** One release: the `## [<version>] - <date>` heading, and its notes. */
export interface ChangelogRelease extends ChangelogNotes {
  /** Semver, as authored — also the fragment the release is addressed by. */
  version: string;
  /** Calendar date, `YYYY-MM-DD`, the same in every language. */
  date: string;
}

/** A parsed changelog document. */
export interface Changelog {
  /** The document's own `# …`, localized. */
  title: string;
  /** The paragraphs between the title and the first release. */
  intro: string;
  /** What `## [Unreleased]` collects for the next release; no app shows it. */
  unreleased: ChangelogNotes | null;
  /** The releases, in the order the document lists them: newest first. */
  releases: ChangelogRelease[];
  /**
   * The link reference definitions of the headings, by label (a version or
   * `Unreleased`). They render as the headings' links on GitHub and are taken
   * out of the notes they would otherwise trail.
   */
  links: Readonly<Record<string, string>>;
}

const VERSION = String.raw`\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?`;

/** `## [2.1.0] - 2026-08-06`, the one shape a release heading may have. */
const RELEASE_HEADING = new RegExp(
  String.raw`^##\s+\[(${VERSION})\]\s+-\s+(\d{4}-\d{2}-\d{2})\s*$`
);

const UNRELEASED_HEADING = /^##\s+\[Unreleased\]\s*$/;

/** `[2.1.0]: https://…`, a heading's link reference definition. */
const HEADING_LINK = new RegExp(
  String.raw`^\[(Unreleased|${VERSION})\]:\s*(\S+)\s*$`
);

const FENCE = /^\s*(```|~~~)/;

/**
 * A release's date as the instant it names. It is a calendar date, so it is
 * midnight UTC: read in a zone west of it, a local instant would name the day
 * before, and the feed's `updated` has to be a date-time either way.
 */
export function releaseInstant(date: string): string {
  return `${date}T00:00:00Z`;
}

/**
 * Splits a changelog in `lang` into its title, its intro and its releases.
 *
 * A second-level heading that is not a release heading, or a section heading
 * that is not one of the language's kinds in their order, throws rather than
 * being skipped: a mistyped date would otherwise drop that release out of the
 * feed and off the page silently, in one language, which nothing else would
 * catch.
 */
export function parseChangelog(markdown: string, lang: string): Changelog {
  const titles = CHANGE_SECTION_TITLES[lang];
  if (!titles) {
    throw new Error(`No changelog section titles for language: ${lang}`);
  }

  let title = '';
  const intro: string[] = [];
  let unreleased: ChangelogNotes | null = null;
  const releases: ChangelogRelease[] = [];
  const links: Record<string, string> = {};
  let current:
    Omit<ChangelogRelease, 'body' | 'sections'> | 'unreleased' | null = null;
  let body: string[] = [];
  let fenced = false;

  const closeBlock = (): void => {
    if (current === 'unreleased') {
      unreleased = parseNotes(body, titles, 'Unreleased');
    } else if (current) {
      const notes = parseNotes(body, titles, current.version);
      if (notes.sections.length === 0) {
        throw new Error(`Release ${current.version} has no sections`);
      }
      releases.push({ ...current, ...notes });
    }
    body = [];
  };

  // Split on either ending: a heading regex anchored with `$` matches nothing
  // when a trailing `\r` is left on the line, and the title would go missing on
  // a checkout that carries them.
  for (const line of markdown.split(/\r?\n/)) {
    if (FENCE.test(line)) {
      fenced = !fenced;
    }
    // Only above the first release: a `# …` further down belongs to the notes
    // it is written in, and taking it would rename the document silently.
    if (!fenced && !current && line.startsWith('# ')) {
      title = line.slice(2).trim();
      continue;
    }
    if (!fenced && line.startsWith('## ')) {
      closeBlock();
      if (UNRELEASED_HEADING.test(line)) {
        if (current) {
          throw new Error('[Unreleased] must come before every release');
        }
        current = 'unreleased';
        continue;
      }
      const release = RELEASE_HEADING.exec(line);
      if (!release) {
        throw new Error(`Not a release heading: ${line.trim()}`);
      }
      current = { version: release[1], date: release[2] };
      continue;
    }
    const link = fenced ? null : HEADING_LINK.exec(line);
    if (link) {
      links[link[1]] = link[2];
      continue;
    }
    (current ? body : intro).push(line);
  }
  closeBlock();

  return { title, intro: joinBlock(intro), unreleased, releases, links };
}

/** The notes of one heading, split into their sections. */
function parseNotes(
  lines: readonly string[],
  titles: Readonly<Record<ChangeKind, string>>,
  heading: string
): ChangelogNotes {
  const sections: ChangelogSection[] = [];
  let section: { kind: ChangeKind; lines: string[] } | null = null;
  let fenced = false;

  const closeSection = (): void => {
    if (section) {
      sections.push({ kind: section.kind, body: joinBlock(section.lines) });
    }
  };

  for (const line of lines) {
    if (FENCE.test(line)) {
      fenced = !fenced;
    }
    if (!fenced && line.startsWith('### ')) {
      const name = line.slice(4).trim();
      const kind = CHANGE_KINDS.find(
        (candidate) => sectionHeading(candidate, titles) === name
      );
      const last = section?.kind;
      if (
        !kind ||
        (last && CHANGE_KINDS.indexOf(kind) <= CHANGE_KINDS.indexOf(last))
      ) {
        const expected = CHANGE_KINDS.map((candidate) =>
          sectionHeading(candidate, titles)
        );
        throw new Error(
          `Not a section of ${heading} (expected ${expected.join(', ')}, ` +
            `in that order, each at most once): ${line.trim()}`
        );
      }
      closeSection();
      section = { kind, lines: [] };
      continue;
    }
    section?.lines.push(line);
  }
  closeSection();

  return { body: joinBlock(lines), sections };
}

/** The text of a kind's `### …` heading. */
function sectionHeading(
  kind: ChangeKind,
  titles: Readonly<Record<ChangeKind, string>>
): string {
  return `${CHANGE_EMOJI[kind]} ${titles[kind]}`;
}

/** The lines as one block, without the blank lines around it. */
function joinBlock(lines: readonly string[]): string {
  return lines.join('\n').trim();
}
