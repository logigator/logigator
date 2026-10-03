/**
 * The changelog, as data: the release headings the editor's dialog only ever
 * renders as prose, so the website can draw one block per release and its feed
 * can carry one entry per release.
 *
 * The document itself stays the authored markdown — one file per language
 * beside the documentation pages, `changelog/<lang>.md` — and each app imports
 * it through its own loader, as it does every other page here.
 */

/** One release: the `## <version> — <date>` heading, and everything under it. */
export interface ChangelogRelease {
  /** Semver, as authored — also the fragment the release is addressed by. */
  version: string;
  /** Calendar date, `YYYY-MM-DD`, the same in every language. */
  date: string;
  /** The notes below the heading, markdown, starting at `### …`. */
  body: string;
}

/** A parsed changelog document. */
export interface Changelog {
  /** The document's own `# …`, localized. */
  title: string;
  /** The paragraphs between the title and the first release. */
  intro: string;
  /** The releases, in the order the document lists them: newest first. */
  releases: ChangelogRelease[];
}

/** `## 2.1.0 — 2026-08-06`, the one shape a release heading may have. */
const RELEASE_HEADING = /^##\s+(\S+)\s+—\s+(\d{4}-\d{2}-\d{2})\s*$/;

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
 * Splits a changelog into its title, its intro and its releases.
 *
 * A second-level heading that is not a release heading throws rather than being
 * skipped: a mistyped date would otherwise drop that release out of the feed
 * and off the page silently, in one language, which nothing else would catch.
 */
export function parseChangelog(markdown: string): Changelog {
  let title = '';
  const intro: string[] = [];
  const releases: ChangelogRelease[] = [];
  let current: Omit<ChangelogRelease, 'body'> | null = null;
  let body: string[] = [];
  let fenced = false;

  const closeRelease = (): void => {
    if (current) {
      releases.push({ ...current, body: joinBlock(body) });
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
      const release = RELEASE_HEADING.exec(line);
      if (!release) {
        throw new Error(`Not a release heading: ${line.trim()}`);
      }
      closeRelease();
      current = { version: release[1], date: release[2] };
      continue;
    }
    (current ? body : intro).push(line);
  }
  closeRelease();

  return { title, intro: joinBlock(intro), releases };
}

/** The lines as one block, without the blank lines around it. */
function joinBlock(lines: readonly string[]): string {
  return lines.join('\n').trim();
}
