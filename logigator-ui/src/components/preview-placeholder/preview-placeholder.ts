import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * What stands in for a circuit's render where there is none.
 *
 * A preview is what the editor uploads as it saves a project, so a circuit it
 * never rendered has none: every library component, a circuit cloned from
 * another, a save whose render failed. The row's column is nullable, and a
 * frame left empty cannot be told from a board that happens to be blank. A
 * muted image glyph on the frame's dot ground says which it is — no picture
 * *yet*, on a board that could hold one.
 *
 * The glyph is measured against the box it is given rather than the viewport,
 * because the box is what differs between the places this appears: a
 * quarter-page tile and a document page's render are the same mark at two
 * sizes. It is capped, so it stays a mark on a large frame rather than growing
 * into an illustration.
 *
 * A consumer draws the frame: its border, and the dot ground, which is a class
 * on the frame so it bleeds to that border rather than stopping at the render's
 * padding. This fills whatever it is put in — with a render, it is not drawn at
 * all.
 *
 * Nothing here is announced to a screen reader: the circuit's own name is what
 * a reader gets from the tile or the page, and the absence of a picture is not
 * a second name for it.
 */
@Component({
  selector: 'lg-preview-placeholder',
  host: { class: '@container flex h-full w-full items-center justify-center' },
  template: `
    <i
      class="ph ph-image text-[length:min(12cqw,3.5rem)] text-muted"
      aria-hidden="true"
    ></i>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LgPreviewPlaceholder {}
