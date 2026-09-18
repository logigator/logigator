import { Rectangle } from 'pixi.js';
import { clamp } from '../../../utils/math';

/**
 * Maps a framed region (grid units) onto the fixed minimap panel (CSS px):
 * `contain` fit — one uniform scale, centered with letterbox offsets.
 */
export interface MapFit {
  /** CSS px per grid unit. */
  scale: number;
  /** Letterbox offsets (CSS px) of the region inside the panel. */
  offsetX: number;
  offsetY: number;
}

/** An axis-aligned box in minimap panel coordinates (CSS px). */
export interface PanelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The frame is kept while the content region still covers this fraction of its
 * area, so shrinking content only re-frames once the shrink is substantial.
 */
const MIN_COVERAGE = 0.5;
/** Slack added around a fresh frame, as a fraction of its larger dimension. */
const SLACK_FACTOR = 0.1;
/** Lower bound (grid units) so tiny circuits get real headroom. */
const SLACK_MIN_GRID = 2;

/** `contain`-fits a region into a panel box. */
export function fitRegion(
  region: Rectangle,
  panelWidth: number,
  panelHeight: number
): MapFit {
  const scale = Math.min(
    panelWidth / region.width,
    panelHeight / region.height
  );
  return {
    scale,
    offsetX: (panelWidth - region.width * scale) / 2,
    offsetY: (panelHeight - region.height * scale) / 2
  };
}

/**
 * Frame hysteresis: keeps the current frame while the content region fits
 * inside it and covers enough of it, otherwise re-frames to the region plus
 * slack. A burst of edits at the content edge re-frames once, not per action.
 */
export function nextFrame(
  current: Rectangle | null,
  region: Rectangle
): Rectangle {
  if (
    current &&
    current.containsRect(region) &&
    region.width * region.height >=
      MIN_COVERAGE * current.width * current.height
  ) {
    return current;
  }
  const slack = Math.max(
    SLACK_MIN_GRID,
    SLACK_FACTOR * Math.max(region.width, region.height)
  );
  return new Rectangle(
    region.x - slack,
    region.y - slack,
    region.width + 2 * slack,
    region.height + 2 * slack
  );
}

/**
 * Maps the visible viewport (grid units) into panel coordinates: clips at the
 * panel edges when the camera is outside the frame, then enforces a minimum
 * on-screen size so a deep zoom-in stays visible.
 */
export function mapViewportRect(
  viewOrigin: { x: number; y: number },
  viewSize: { x: number; y: number },
  frame: Rectangle,
  fit: MapFit,
  panelWidth: number,
  panelHeight: number,
  minSizePx: number
): PanelRect {
  const raw: PanelRect = {
    x: (viewOrigin.x - frame.x) * fit.scale + fit.offsetX,
    y: (viewOrigin.y - frame.y) * fit.scale + fit.offsetY,
    width: viewSize.x * fit.scale,
    height: viewSize.y * fit.scale
  };

  // Clip to the panel. A viewport entirely off-map collapses to a zero-size box
  // pinned at the nearest edge, which the min-size pass below re-inflates into
  // an edge-hugging marker.
  const left = clamp(raw.x, 0, panelWidth);
  const top = clamp(raw.y, 0, panelHeight);
  const right = clamp(raw.x + raw.width, 0, panelWidth);
  const bottom = clamp(raw.y + raw.height, 0, panelHeight);

  const width = Math.max(right - left, Math.min(minSizePx, panelWidth));
  const height = Math.max(bottom - top, Math.min(minSizePx, panelHeight));
  // Grow around the clipped box's center, then push back inside the panel.
  const x = clamp((left + right - width) / 2, 0, panelWidth - width);
  const y = clamp((top + bottom - height) / 2, 0, panelHeight - height);

  return { x, y, width, height };
}
