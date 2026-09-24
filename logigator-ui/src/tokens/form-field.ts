/**
 * Shared styling for text-entry form fields. Two things are deliberate: the
 * background and border use a dedicated form-field surface one step stronger
 * than the content surface, named per scheme because the surface scale's
 * meaning flips between the light slate ramp and the dark zinc one; and there
 * is **no focus ring** — the border switching to `primary` is the only cue.
 *
 * Plain class strings, no Angular, so directives and components can compose
 * them onto a native element or a wrapper.
 */

import { controlPadding, LgSize } from './size';

export const FORM_FIELD_BASE =
  'bg-surface-0 dark:bg-surface-950 text-text ' +
  'border border-surface-300 dark:border-surface-600 rounded-md shadow-xs outline-none ' +
  'appearance-none transition-colors duration-200 ' +
  'placeholder:text-muted ' +
  'hover:border-surface-400 dark:hover:border-surface-500 focus:border-primary ' +
  'disabled:pointer-events-none disabled:opacity-60';

/**
 * Invalid state: a red border that survives hover, but still yields to the
 * primary focus border so the user gets normal feedback while editing.
 */
export const FORM_FIELD_INVALID =
  'border-error! hover:border-error! focus:border-primary!';

/** The full class string for a text-entry field at a given size and validity. */
export function formFieldClasses(
  size: LgSize | undefined,
  invalid: boolean
): string {
  return [
    FORM_FIELD_BASE,
    controlPadding(size),
    invalid ? FORM_FIELD_INVALID : ''
  ]
    .filter(Boolean)
    .join(' ');
}
