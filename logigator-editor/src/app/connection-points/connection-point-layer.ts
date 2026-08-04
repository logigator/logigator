import { Container } from 'pixi.js';
import { ConnectionPoint } from './connection-point';

export class ConnectionPointLayer extends Container<ConnectionPoint> {
  constructor() {
    // Junction dots live board-wide in this one layer, so give it its own
    // render group: dot insertions/removals dirty only this group's
    // instruction set instead of forcing the root group to re-collect and
    // re-batch the full scene.
    super({ isRenderGroup: true });
  }

  public applyScale(scale: number): void {
    for (const cp of this.children) {
      cp.applyScale(scale);
    }
  }
}
