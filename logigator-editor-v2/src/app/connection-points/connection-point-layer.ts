import { Container } from 'pixi.js';
import { ConnectionPoint } from './connection-point';

export class ConnectionPointLayer extends Container<ConnectionPoint> {
  constructor() {
    super();
    this.cullableChildren = false;
  }

  public applyScale(scale: number): void {
    for (const cp of this.children) {
      cp.applyScale(scale);
    }
  }
}
