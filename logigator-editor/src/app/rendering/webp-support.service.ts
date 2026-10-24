import { Injectable } from '@angular/core';
import {
  NO_WEBP_SUPPORT,
  WEBP_LOSSLESS_QUALITY,
  WebpSupport,
  webpSupportOf
} from './webp-support';

/**
 * What this browser's canvas can encode as WebP, probed on first read by
 * encoding a one-pixel canvas and reading what came back. A browser that cannot
 * encode WebP answers a PNG instead (Safari), and one that can may still encode
 * lossy at every quality, so neither is a version check.
 */
@Injectable({ providedIn: 'root' })
export class WebpSupportService implements WebpSupport {
  private _probed?: WebpSupport;

  public get encode(): boolean {
    return this._probe().encode;
  }

  public get lossless(): boolean {
    return this._probe().lossless;
  }

  private _probe(): WebpSupport {
    return (this._probed ??= probe());
  }
}

function probe(): WebpSupport {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const url = canvas.toDataURL('image/webp', WEBP_LOSSLESS_QUALITY);
    return url ? webpSupportOf(url) : NO_WEBP_SUPPORT;
  } catch {
    return NO_WEBP_SUPPORT;
  }
}
