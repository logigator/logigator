import { Container } from 'pixi.js';
import { ConnectionPoint } from './connection-point';

export class ConnectionPointLayer extends Container<ConnectionPoint> {
  constructor() {
    // Its own render group, so a dot insertion or removal dirties only this
    // group's instruction set instead of re-batching the whole scene.
    super({ isRenderGroup: true });
  }

  public applyScale(scale: number): void {
    for (const cp of this.children) {
      cp.applyScale(scale);
    }
  }
}
