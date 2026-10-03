import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Phosphor's own `star` and `star-fill`, on the 1024 grid its glyphs are drawn
 * on — so the two states are the same star the icon font draws everywhere else,
 * at the same size for the same `font-size`.
 *
 * Inlined rather than set with the font's `ph-fill` class, which is what the
 * star button used to ask for: the site loads Phosphor's **regular** weight
 * only, so `ph-fill` named a font family that does not exist and the starred
 * star rendered as nothing at all. The filled weight is a 132 kB font and 13 kB
 * gzipped of class rules in the stylesheet every page loads, which is a lot to
 * pay for one glyph — these two paths are 2.1 kB in the chunk of the one page
 * that draws them.
 */
const STAR =
  'M956.72 389.040c-8.252-24.821-30.285-42.819-56.802-45.024l-0.238-0.016-236-19.040-91.12-220.36c-10.048-24.023-33.359-40.594-60.54-40.594s-50.492 16.572-60.38 40.163l-0.16 0.431-91.040 220.32-236.12 19.080c-33.896 2.952-60.291 31.197-60.291 65.606 0 19.875 8.806 37.693 22.729 49.765l0.082 0.070 180 155.32-54.84 232.24c-1.178 4.648-1.854 9.983-1.854 15.476 0 36.186 29.334 65.52 65.52 65.52 12.706 0 24.568-3.617 34.611-9.877l-0.277 0.161 202-124.32 202.12 124.32c9.708 5.991 21.475 9.541 34.070 9.541 36.23 0 65.6-29.37 65.6-65.6 0-5.401-0.653-10.65-1.884-15.671l0.093 0.45-55.040-232.28 180-155.32c14.121-12.126 23.010-30 23.010-49.95 0-7.297-1.189-14.316-3.384-20.874l0.135 0.464zM895.36 410.92l-194.8 168c-6.819 5.902-11.108 14.569-11.108 24.239 0 2.626 0.316 5.178 0.913 7.62l-0.045-0.219 59.52 251.2c0.081 0.177 0.128 0.384 0.128 0.601 0 0.572-0.325 1.068-0.8 1.315l-0.008 0.004c-0.72 0.56-0.92 0.44-1.52 0l-218.88-134.6c-4.768-2.976-10.558-4.74-16.76-4.74s-11.992 1.764-16.895 4.819l0.135-0.079-218.88 134.68c-0.6 0.36-0.76 0.48-1.52 0-0.483-0.25-0.808-0.746-0.808-1.319 0-0.218 0.047-0.425 0.132-0.611l-0.004 0.009 59.52-251.2c0.551-2.223 0.868-4.775 0.868-7.401 0-9.669-4.289-18.337-11.067-24.204l-0.040-0.034-194.8-168c-0.48-0.4-0.92-0.76-0.52-2s0.72-1.080 1.32-1.16l255.68-20.64c12.183-1.076 22.322-8.835 26.802-19.549l0.078-0.211 98.48-238.44c0.32-0.68 0.44-1 1.4-1s1.080 0.32 1.4 1l98.72 238.44c4.598 10.925 14.785 18.664 26.884 19.672l0.116 0.008 255.68 20.64c0.6 0 0.96 0 1.32 1.16s-0 1.6-0.64 2z';

const STAR_FILL =
  'M937.16 459.4l-180 155.32 54.84 232.28c1.151 4.597 1.811 9.875 1.811 15.307 0 36.23-29.37 65.6-65.6 65.6-12.654 0-24.471-3.583-34.492-9.789l0.281 0.162-202-124.32-202.12 124.32c-9.708 5.991-21.475 9.541-34.070 9.541-36.23 0-65.6-29.37-65.6-65.6 0-5.401 0.653-10.65 1.884-15.671l-0.093 0.45 55.040-232.28-180-155.32c-13.991-12.141-22.788-29.95-22.788-49.814 0-34.33 26.275-62.524 59.812-65.568l0.256-0.019 236-19.040 91.040-220.32c10.048-24.023 33.359-40.594 60.54-40.594s50.492 16.572 60.38 40.163l0.16 0.431 91 220.32 236 19.040c33.896 2.952 60.291 31.197 60.291 65.606 0 19.875-8.806 37.693-22.729 49.765l-0.082 0.070z';

/**
 * The star beside a document's star control, filled while the reader has
 * starred it.
 *
 * `currentColor` and a `1em` box, so it takes the colour and the size of the
 * text it sits beside exactly as an `<i class="ph ph-star">` would — the button
 * tints it by setting its own text colour, not by asking this for a colour.
 *
 * Written as an element with an `[attr.d]` binding rather than assigned as
 * markup: Angular's sanitizer drops SVG from `[innerHTML]` entirely.
 */
@Component({
  selector: 'web-star-icon',
  host: { class: 'inline-flex' },
  template: `
    <svg
      viewBox="0 0 1024 1024"
      class="size-[1em] shrink-0 fill-current"
      aria-hidden="true"
      focusable="false"
    >
      <path [attr.d]="filled() ? STAR_FILL : STAR" />
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StarIcon {
  readonly filled = input.required<boolean>();

  protected readonly STAR = STAR;
  protected readonly STAR_FILL = STAR_FILL;
}
