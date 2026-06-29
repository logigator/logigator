/**
 * Shared styling for text-entry form fields (InputText, Textarea, InputNumber,
 * and later Select). Encodes the deliberate, colors-only field look:
 *
 * - background = `content`, text = `text`, border = `border`
 * - hover darkens the border; focus switches it to `primary`
 * - **no visible focus ring** — the border-color change is the only focus cue
 * - placeholder = `muted`; disabled dims and blocks interaction
 * - 6px radius (`rounded-md`); two paddings (default + `small`)
 *
 * These are plain class strings (no Angular) so directives and components can
 * compose them onto a native element or a wrapper.
 */

export const FORM_FIELD_BASE =
  'bg-content text-text border border-border rounded-md outline-none ' +
  'appearance-none transition-colors duration-200 ' +
  'placeholder:text-muted ' +
  'hover:border-muted focus:border-primary ' +
  'disabled:pointer-events-none disabled:opacity-60';

export const FORM_FIELD_PADDING = 'px-3 py-2 text-base';
export const FORM_FIELD_PADDING_SMALL = 'px-2.5 py-1.5 text-sm';

/**
 * Invalid state: a red border that survives hover, but still yields to the
 * primary focus border so the user gets normal feedback while editing.
 */
export const FORM_FIELD_INVALID =
  'border-error! hover:border-error! focus:border-primary!';
