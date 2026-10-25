import { CanvasTextMetrics } from 'pixi.js';

/**
 * Whether every character is ASCII other than CR: each such character is its
 * own grapheme cluster, CR LF being the one ASCII pair that forms a single one.
 */
function isSingleClusterAscii(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code > 0x7f || code === 0x0d) return false;
  }
  return true;
}

let installed = false;

/**
 * Splits ASCII text per character and hands anything else to PixiJS's own
 * segmenter.
 *
 * PixiJS runs `CanvasTextMetrics.graphemeSegmenter` on every text layout,
 * more than once per BitmapText, and its default is an `Intl.Segmenter` pass.
 * Rendering a large board for the first time spent about 670 ms in it (99k
 * components), nearly all of it on labels and symbols that are plain ASCII,
 * where the answer is the characters. The hook is public for exactly this
 * kind of replacement.
 */
export function installAsciiGraphemeFastPath(): void {
  if (installed) return;
  installed = true;
  const segment = CanvasTextMetrics.graphemeSegmenter;
  CanvasTextMetrics.graphemeSegmenter = (s: string): string[] =>
    isSingleClusterAscii(s) ? s.split('') : segment(s);
}
