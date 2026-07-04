import { Signal } from '@angular/core';

export interface WindowSize {
  width: number;
  height: number;
}

export interface WindowPoint {
  x: number;
  y: number;
}

/** Configuration for a floating window ({@link WindowService.open}). */
export interface WindowConfig {
  /** Title-bar text. A signal keeps the title live while the window is open. */
  title?: string | Signal<string>;
  /**
   * Inputs applied to the content component via `setInput()` before its first
   * change detection, so `input.required` signals resolve.
   */
  inputValues?: Record<string, unknown>;
  /** Show a close button and close on Escape. Defaults to true. */
  closable?: boolean;
  /** Content-box size on open. Defaults to 440×360. */
  initialSize?: WindowSize;
  /** Smallest size the user can resize to. Defaults to 240×160. */
  minSize?: WindowSize;
  /** Largest size the user can resize to. Unbounded by default. */
  maxSize?: WindowSize;
  /**
   * Top-left position inside the outlet. Defaults to a cascade — each open
   * window sits a step below/right of the previous one.
   */
  initialPosition?: WindowPoint;
  /** Classes for the content region, replacing the default `p-3` padding. */
  bodyClass?: string;
}
