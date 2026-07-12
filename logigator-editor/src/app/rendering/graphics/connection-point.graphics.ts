import { StaticGraphicsContext } from './static-graphics-context';

export class ConnectionPointGraphics extends StaticGraphicsContext {
  // White base like WireGraphics: the dot's color lives in the per-instance
  // tint, keeping the context theme-independent.
  public static override readonly themeIndependent = true;

  constructor() {
    super();
    this.rect(0, 0, 1, 1);
    this.fill(0xffffff);
  }
}
