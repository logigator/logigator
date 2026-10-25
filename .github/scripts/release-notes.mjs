// Prints the GitHub release notes for a tag, after checking that the tag, the
// root package.json's version and every changelog document agree on it.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
//     .github/scripts/release-notes.mjs v2.3.0 > release-notes.md
//
// Node runs the parser's TypeScript source directly (type stripping), so the
// release reads the documents exactly as the apps do. The warning it disables
// is that source being read as ESM in a package without `"type": "module"`.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseChangelog } from '../../logigator-docs/src/changelog.ts';

const REPOSITORY = 'https://github.com/logigator/logigator';
const SITE = 'https://logigator.com';
const ROOT = join(import.meta.dirname, '..', '..');

const fail = (message) => {
  console.error(`::error::${message}`);
  process.exit(1);
};

const tag = process.argv[2] ?? '';
if (!tag.startsWith('v')) {
  fail(`Not a release tag: "${tag}"`);
}
const version = tag.slice(1);

const product = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
if (product.version !== version) {
  fail(`${tag} does not match package.json (${product.version})`);
}

const english = parseChangelog(
  readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8'),
  'en'
);
const [release, previous] = english.releases;
if (release?.version !== version) {
  fail(
    `The newest release in CHANGELOG.md is ${release?.version}, not ${version}`
  );
}
if (english.unreleased?.body) {
  fail('CHANGELOG.md still has entries under [Unreleased]');
}

const translations = readdirSync(join(ROOT, 'changelog'))
  .filter((file) => file.endsWith('.md'))
  .map((file) => file.slice(0, -'.md'.length));
for (const lang of translations) {
  const translated = parseChangelog(
    readFileSync(join(ROOT, 'changelog', `${lang}.md`), 'utf8'),
    lang
  );
  const [newest] = translated.releases;
  if (newest?.version !== version || newest.date !== release.date) {
    fail(
      `changelog/${lang}.md does not list ${version} (${release.date}) first`
    );
  }
  if (translated.unreleased?.body) {
    fail(`changelog/${lang}.md still has entries under [Unreleased]`);
  }
}

/** A language's own name for itself, capitalized the way a link starts. */
const nativeName = (lang) => {
  const name = new Intl.DisplayNames([lang], { type: 'language' }).of(lang);
  return name.charAt(0).toLocaleUpperCase(lang) + name.slice(1);
};

const translated = new Intl.ListFormat('en', { type: 'conjunction' }).format(
  translations.map(
    (lang) => `[${nativeName(lang)}](${SITE}/${lang}/changelog#${version})`
  )
);
const footer = [
  `Also in ${translated}.`,
  ...(previous
    ? [
        `[Changes since ${previous.version}](${REPOSITORY}/compare/v${previous.version}...${tag})`
      ]
    : [])
];

process.stdout.write(`${release.body}\n\n---\n\n${footer.join('\n\n')}\n`);
