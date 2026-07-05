import { inject, Injectable } from '@angular/core';
import { Assets, BitmapFont, Cache } from 'pixi.js';
import { TranslocoService } from '@jsverse/transloco';
import robotoMonoUrl from '@assets/roboto-mono-regular-subset.woff2';
import { CANVAS_FONT_CHARS, CANVAS_FONT_FAMILY } from '../utils/text-fit';
import { ToastService } from '../logging/toast.service';

/**
 * Family the subset woff2 is registered under for atlas baking. Deliberately
 * NOT 'Roboto Mono': the Google Fonts stylesheet registers lazy same-named
 * faces, and if the browser resolves the bake's fontFamily to one that is
 * still unloaded, canvas rasterization silently falls back to a default font
 * and the fallback gets baked into the atlas. A unique family only ever
 * resolves to the FontFace that Assets.load has already awaited.
 */
const BAKE_FONT_FAMILY = 'Roboto Mono Canvas';

@Injectable({
  providedIn: 'root'
})
export class AssetsService {
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  constructor() {
    if (!Assets.resolver.hasKey(BAKE_FONT_FAMILY)) {
      Assets.add({
        alias: BAKE_FONT_FAMILY,
        src: robotoMonoUrl,
        data: { family: BAKE_FONT_FAMILY }
      });
    }
  }

  async init() {
    // The FontFace must be loaded before the install below rasterizes the
    // atlas, or the glyphs get baked from a fallback font.
    try {
      await Assets.load([BAKE_FONT_FAMILY]);
    } catch (err) {
      this.toast.error(
        this.transloco.translate('editor.fontLoadFailed'),
        err,
        'AssetsService'
      );
      throw err;
    }

    if (Cache.has(`${CANVAS_FONT_FAMILY}-bitmap`)) {
      return;
    }
    // All canvas text renders as BitmapText from this one atlas; zooming only
    // scales glyph quads, so no text is ever re-rasterized. Glyphs are baked
    // at 48 px × resolution 2 = 96 physical px — above the largest size
    // built-in text can reach on screen (16 px symbols × 2.49 max zoom ×
    // devicePixelRatio 2 ≈ 80 px), so built-in text stays crisp at every
    // zoom. Only the free-text component at large user font sizes can exceed
    // the bake and go slightly soft. dynamicFill keeps the atlas white so a
    // BitmapText's fill acts as a per-instance tint (theme colors).
    BitmapFont.install({
      name: CANVAS_FONT_FAMILY,
      style: {
        fontFamily: BAKE_FONT_FAMILY,
        fontSize: 48,
        fill: 0xffffff
      },
      chars: CANVAS_FONT_CHARS,
      resolution: 2,
      dynamicFill: true
    });
  }
}
