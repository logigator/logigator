/**
 * Markdown imports. `.md` is a `text` loader in the build's `loader` map (see
 * `angular.json`), not a `file` one: the import is the file's own text rather
 * than a URL, so a page's long-form copy is compiled into the chunk that asks
 * for it. That is what lets a server render write the text into its first byte
 * without fetching anything.
 */

declare module '*.md' {
  const text: string;
  export default text;
}
