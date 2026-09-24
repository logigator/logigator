import { Injectable } from '@angular/core';

/** The part of an element this service measures — a DOM box, or a test stub. */
export interface Measurable {
  getBoundingClientRect(): {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/** A box in viewport CSS px. */
export interface SurfaceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where the board canvas sits on the page. The camera speaks grid units and
 * the viewport controller board-local px, so a driver pointing at something on
 * the page needs the offset neither of them owns. `null` with no board mounted.
 */
@Injectable({ providedIn: 'root' })
export class BoardSurfaceService {
  private surface: Measurable | null = null;

  public register(surface: Measurable): void {
    this.surface = surface;
  }

  /** Drops `surface`; a later registration wins, so a stale drop is ignored. */
  public unregister(surface: Measurable): void {
    if (this.surface === surface) {
      this.surface = null;
    }
  }

  /** The canvas box in viewport CSS px, or `null` with no board mounted. */
  public rect(): SurfaceRect | null {
    const box = this.surface?.getBoundingClientRect();
    return box
      ? { x: box.x, y: box.y, width: box.width, height: box.height }
      : null;
  }
}
