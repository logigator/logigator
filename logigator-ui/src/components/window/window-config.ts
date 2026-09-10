import { Signal } from '@angular/core';

export interface WindowSize {
  width: number;
  height: number;
}

export interface WindowPoint {
  x: number;
  y: number;
}

export interface WindowRect extends WindowPoint, WindowSize {}

/** One segment of a structured window title (e.g. a breadcrumb). */
export interface WindowTitlePart {
  label: string;
  /** Makes the segment a clickable action (e.g. breadcrumb navigation). */
  command?: () => void;
}

export interface WindowConfig {
  /** Title-bar text. A signal keeps the title live while the window is open. */
  title?: string | Signal<string>;
  /**
   * Title segments rendered as a `›`-separated breadcrumb. When non-empty it
   * takes the title bar over from {@link title}, which still feeds the
   * window's aria-label.
   */
  titleParts?: Signal<readonly WindowTitlePart[]>;
  /**
   * Applied to the content component before its first change detection, so
   * `input.required` signals resolve.
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
  /** Top-left position inside the outlet. Defaults to a cascade. */
  initialPosition?: WindowPoint;
  /** Classes for the content region, replacing the default `p-3` padding. */
  bodyClass?: string;
}
