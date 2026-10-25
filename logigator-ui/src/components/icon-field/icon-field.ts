import { Component, input } from '@angular/core';

/**
 * Positions a single {@link LgInputIcon} over a padded form field: the icon is
 * absolutely positioned on the `iconPosition` edge and the projected `<input>`
 * gets matching padding so its text clears it.
 */
@Component({
  selector: 'lg-icon-field',
  host: { '[attr.data-icon-position]': 'iconPosition()' },
  template: `<ng-content></ng-content>`,
  styles: `
    :host {
      display: block;
      position: relative;
    }
    :host ::ng-deep lg-input-icon {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      line-height: 1;
    }
    :host([data-icon-position='left']) ::ng-deep lg-input-icon {
      left: 0.75rem;
    }
    :host([data-icon-position='right']) ::ng-deep lg-input-icon {
      right: 0.75rem;
    }
    :host([data-icon-position='left']) ::ng-deep input {
      padding-left: 2.5rem;
    }
    :host([data-icon-position='right']) ::ng-deep input {
      padding-right: 2.5rem;
    }
  `
})
export class LgIconField {
  readonly iconPosition = input<'left' | 'right'>('left');
}
