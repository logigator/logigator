import { inject, Injectable } from '@angular/core';
import { Assets, BitmapFont, Cache, TextStyleOptions } from 'pixi.js';
import { TranslationService } from '../translation/translation.service';
import robotoMonoUrl from '@assets/roboto-mono-regular-subset.woff2';
import dseg7Url from '@assets/DSEG7Modern-BoldItalic.woff2';
import dseg14Url from '@assets/DSEG14Modern-BoldItalic.woff2';
import { CANVAS_FONT_CHARS, CANVAS_FONT_FAMILY } from '../utils/text-fit';
import { ToastService } from '../logging/toast.service';
import {
  SEGMENT_FONT_7,
  SEGMENT_FONT_14,
  SEGMENT_FONT_CHARS
} from '../utils/segment-font';

/**
 * Family the subset woff2 is registered under for atlas baking. The name must
 * be unique: resolving the bake's fontFamily to a UI family that is still
 * lazy-loading bakes the fallback font into the atlas silently.
 */
const BAKE_FONT_FAMILY = 'Roboto Mono Canvas';

/** Bake families for the seven/fourteen-segment display faces (see above). */
const BAKE_SEGMENT_7_FAMILY = 'DSEG7 Canvas';
const BAKE_SEGMENT_14_FAMILY = 'DSEG14 Canvas';

@Injectable({
  providedIn: 'root'
})
export class AssetsService {
  private readonly toast = inject(ToastService);
  private readonly translation = inject(TranslationService);

  constructor() {
    for (const [alias, src] of [
      [BAKE_FONT_FAMILY, robotoMonoUrl],
      [BAKE_SEGMENT_7_FAMILY, dseg7Url],
      [BAKE_SEGMENT_14_FAMILY, dseg14Url]
    ]) {
      if (!Assets.resolver.hasKey(alias)) {
        Assets.add({ alias, src, data: { family: alias } });
      }
    }
  }

  async init() {
    // The FontFaces must load before the installs rasterize the atlases, or
    // the glyphs get baked from a fallback font.
    try {
      await Assets.load([
        BAKE_FONT_FAMILY,
        BAKE_SEGMENT_7_FAMILY,
        BAKE_SEGMENT_14_FAMILY
      ]);
    } catch (err) {
      this.toast.error(
        this.translation.translate('editor.fontLoadFailed'),
        'AssetsService',
        err
      );
      throw err;
    }

    // All canvas text is BitmapText from these atlases, so zooming only
    // scales glyph quads and nothing is re-rasterized. 48 px × resolution 2 =
    // 96 physical px stays above the ~80 px built-in text can reach on screen;
    // only the free-text component at large font sizes goes soft. dynamicFill
    // keeps the atlas white so a BitmapText's fill acts as a tint.
    this._install(CANVAS_FONT_FAMILY, {
      style: { fontFamily: BAKE_FONT_FAMILY, fontSize: 48, fill: 0xffffff },
      chars: CANVAS_FONT_CHARS
    });
    // Digits only (DSEG7), digits + hex (DSEG14). The woff2 outlines are
    // inherently bold-italic and the faces carry default descriptors, so the
    // bake requests the default style too.
    this._install(SEGMENT_FONT_7, {
      style: {
        fontFamily: BAKE_SEGMENT_7_FAMILY,
        fontSize: 48,
        fill: 0xffffff
      },
      chars: SEGMENT_FONT_CHARS
    });
    this._install(SEGMENT_FONT_14, {
      style: {
        fontFamily: BAKE_SEGMENT_14_FAMILY,
        fontSize: 48,
        fill: 0xffffff
      },
      chars: SEGMENT_FONT_CHARS
    });
  }

  private _install(
    name: string,
    options: { style: TextStyleOptions; chars: string[][] }
  ): void {
    if (Cache.has(`${name}-bitmap`)) {
      return;
    }
    BitmapFont.install({
      name,
      style: options.style,
      chars: options.chars,
      resolution: 2,
      dynamicFill: true
    });
  }
}
