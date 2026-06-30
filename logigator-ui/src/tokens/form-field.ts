/**
 * Shared styling for text-entry form fields (InputText, Textarea, InputNumber,
 * and Select). Encodes the deliberate, colors-only field look:
 *
 * - background and border are a dedicated form-field surface, one step stronger
 *   than the content/panel surface: `surface-0`/`surface-300` in light,
 *   `surface-950`/`surface-600` in dark (the surface scale's meaning flips
 *   between the slate light ramp and the zinc dark ramp, so each scheme names
 *   its own step)
 * - text = `text`
 * - hover strengthens the border one further step; focus switches it to `primary`
 * - **no visible focus ring** — the border-color change is the only focus cue
 * - placeholder = `muted`; disabled dims and blocks interaction
 * - 6px radius (`rounded-md`); padding comes from the shared `controlPadding`
 *
 * These are plain class strings (no Angular) so directives and components can
 * compose them onto a native element or a wrapper.
 */

import { controlPadding, LgSize } from './size';

export const FORM_FIELD_BASE =
  'bg-surface-0 dark:bg-surface-950 text-text ' +
  'border border-surface-300 dark:border-surface-600 rounded-md outline-none ' +
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

/**
 * The full class string for a text-entry field at the given size and validity —
 * the shared body of the InputText / Textarea skinning directives.
 */
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
