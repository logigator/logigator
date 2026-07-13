import { Component, input, ViewEncapsulation } from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';

/**
 * Themed markdown renderer. Wraps ngx-markdown's `<markdown>` (parsing via
 * `marked`) and layers a typography treatment keyed on the `--lg-*` palette, so
 * rendered content matches the rest of the UI in either theme.
 *
 * Provide exactly one source: `data` for an in-memory string, or `src` for a
 * URL/asset path the renderer fetches itself (requires `provideMarkdown` with an
 * `HttpClient` loader in the consuming app).
 *
 * Uses `ViewEncapsulation.None` because ngx-markdown injects the parsed HTML as
 * `innerHTML` on its own element, out of reach of emulated encapsulation; every
 * rule is therefore scoped under the `lg-markdown` host element.
 */
@Component({
  selector: 'lg-markdown',
  imports: [MarkdownComponent],
  encapsulation: ViewEncapsulation.None,
  template: `<markdown [data]="data()" [src]="src()" />`,
  styles: `
    lg-markdown {
      display: block;
      color: var(--lg-text);
      font-size: 0.9375rem;
      line-height: 1.6;
    }

    lg-markdown h1,
    lg-markdown h2,
    lg-markdown h3,
    lg-markdown h4 {
      font-weight: 700;
      line-height: 1.25;
      color: var(--lg-text);
    }

    lg-markdown h1 {
      font-size: 1.5rem;
      margin: 0 0 1rem;
    }

    lg-markdown h2 {
      font-size: 1.25rem;
      margin: 1.75rem 0 0.75rem;
      padding-bottom: 0.35rem;
      border-bottom: 1px solid var(--lg-border);
    }

    lg-markdown h3 {
      font-size: 1.0625rem;
      margin: 1.5rem 0 0.5rem;
    }

    lg-markdown h4 {
      font-size: 0.9375rem;
      margin: 1.25rem 0 0.5rem;
      color: var(--lg-content);
    }

    lg-markdown > :first-child {
      margin-top: 0;
    }

    lg-markdown > :last-child {
      margin-bottom: 0;
    }

    lg-markdown p {
      margin: 0 0 0.75rem;
    }

    lg-markdown ul,
    lg-markdown ol {
      margin: 0 0 0.75rem;
      padding-left: 1.5rem;
    }

    lg-markdown li {
      margin: 0.25rem 0;
    }

    lg-markdown li::marker {
      color: var(--lg-muted);
    }

    lg-markdown a {
      color: var(--lg-primary);
      text-decoration: none;
    }

    lg-markdown a:hover {
      text-decoration: underline;
    }

    lg-markdown strong {
      font-weight: 700;
    }

    lg-markdown em {
      font-style: italic;
    }

    lg-markdown code {
      font-family: var(--font-mono, monospace);
      font-size: 0.85em;
      background: var(--lg-surface-100);
      border-radius: 0.25rem;
      padding: 0.1em 0.35em;
    }

    lg-markdown pre {
      background: var(--lg-surface-100);
      border: 1px solid var(--lg-border);
      border-radius: 0.5rem;
      padding: 0.75rem 1rem;
      overflow-x: auto;
      margin: 0 0 0.75rem;
    }

    lg-markdown pre code {
      background: none;
      padding: 0;
      font-size: 0.85rem;
    }

    lg-markdown blockquote {
      margin: 0 0 0.75rem;
      padding: 0.25rem 0 0.25rem 1rem;
      border-left: 3px solid var(--lg-border);
      color: var(--lg-muted);
    }

    lg-markdown hr {
      border: none;
      border-top: 1px solid var(--lg-border);
      margin: 1.5rem 0;
    }

    lg-markdown table {
      border-collapse: collapse;
      margin: 0 0 0.75rem;
      width: 100%;
    }

    lg-markdown th,
    lg-markdown td {
      border: 1px solid var(--lg-border);
      padding: 0.35rem 0.6rem;
      text-align: left;
    }

    lg-markdown th {
      background: var(--lg-surface-100);
      font-weight: 700;
    }

    lg-markdown img {
      max-width: 100%;
    }
  `
})
export class LgMarkdown {
  /** Markdown string to render in place. */
  readonly data = input<string>();
  /** URL/asset path the renderer fetches and renders. */
  readonly src = input<string>();
}
