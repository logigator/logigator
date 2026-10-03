import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * An orthogonal rule that steps down and tees, marking a hand-off between two
 * blocks that would otherwise read as one list.
 *
 * Built from 1px borders rather than a scaled SVG, so the stroke stays exactly
 * one pixel at every width. The junction dot sits on a real three-way tee —
 * a dot on a plain corner would contradict what a connection point means in
 * the editor.
 */
@Component({
  selector: 'web-wire-run',
  host: { class: 'relative block h-7.5', 'aria-hidden': 'true' },
  template: `
    <i
      class="absolute top-1.5 right-30/100 left-0 block border-t border-border"
    ></i>
    <i
      class="absolute top-1.5 left-62/100 block h-4.5 border-l border-border"
    ></i>
    <i
      class="absolute top-6 right-0 left-62/100 block border-t border-border"
    ></i>
    <i
      class="absolute top-1.5 left-62/100 -translate-x-1/2 -translate-y-1/2 block size-1.75 rounded-full bg-border"
    ></i>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WireRun {}
