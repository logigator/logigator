import { Injectable } from '@angular/core';
import { Assets, BitmapFont, Cache, TextStyleOptions } from 'pixi.js';
import robotoMonoUrl from '@assets/roboto-mono-regular-subset.woff2';
import dseg7Url from '@assets/DSEG7Modern-BoldItalic.woff2';
import dseg14Url from '@assets/DSEG14Modern-BoldItalic.woff2';
import { CANVAS_FONT_CHARS, CANVAS_FONT_FAMILY } from '../utils/text-fit';
import {
  SEGMENT_FONT_7,
  SEGMENT_FONT_14,
  SEGMENT_FONT_CHARS
} from '../utils/segment-font';

/**
 * Family the subset woff2 is registered under for atlas baking. Deliberately
 * NOT 'Roboto Mono': the Google Fonts stylesheet registers lazy same-named
 * faces, and if the browser resolves the bake's fontFamily to one that is
 * still unloaded, canvas rasterization silently falls back to a default font
 * and the fallback gets baked into the atlas. A unique family only ever
 * resolves to the FontFace that Assets.load has already awaited.
 */
const BAKE_FONT_FAMILY = 'Roboto Mono Canvas';

/** Bake families for the seven/fourteen-segment display faces (see above). */
const BAKE_SEGMENT_7_FAMILY = 'DSEG7 Canvas';
const BAKE_SEGMENT_14_FAMILY = 'DSEG14 Canvas';

@Injectable({
  providedIn: 'root'
})
export class AssetsService {
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
    // The FontFaces must be loaded before the installs below rasterize the
    // atlases, or the glyphs get baked from a fallback font.
    await Assets.load([
      BAKE_FONT_FAMILY,
      BAKE_SEGMENT_7_FAMILY,
      BAKE_SEGMENT_14_FAMILY
    ]);

    // All canvas text renders as BitmapText from these atlases; zooming only
    // scales glyph quads, so no text is ever re-rasterized. Glyphs are baked
    // at 48 px × resolution 2 = 96 physical px — above the largest size
    // built-in text can reach on screen (16 px symbols × 2.49 max zoom ×
    // devicePixelRatio 2 ≈ 80 px), so built-in text stays crisp at every
    // zoom. Only the free-text component at large user font sizes can exceed
    // the bake and go slightly soft. dynamicFill keeps the atlas white so a
    // BitmapText's fill acts as a per-instance tint (theme colors).
    this._install(CANVAS_FONT_FAMILY, {
      style: { fontFamily: BAKE_FONT_FAMILY, fontSize: 48, fill: 0xffffff },
      chars: CANVAS_FONT_CHARS
    });
    // The segment-display faces: digits only (DSEG7), digits + hex (DSEG14).
    // The woff2 outlines are inherently bold-italic; the faces are registered
    // with default descriptors, so the bake requests the default style too.
    this._install(SEGMENT_FONT_7, {
      style: { fontFamily: BAKE_SEGMENT_7_FAMILY, fontSize: 48, fill: 0xffffff },
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
