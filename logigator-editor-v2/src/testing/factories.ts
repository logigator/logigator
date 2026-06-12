import { FederatedPointerEvent, Point } from 'pixi.js';
import { Wire } from '../app/wires/wire';
import { WireDirection } from '../app/wires/wire-direction.enum';
import { AndComponent } from '../app/components/component-types/and/and.component';
import { andComponentConfig } from '../app/components/component-types/and/and.config';
import { NotComponent } from '../app/components/component-types/not/not.component';
import { notComponentConfig } from '../app/components/component-types/not/not.config';
import { InputComponent } from '../app/components/component-types/input/input.component';
import { inputComponentConfig } from '../app/components/component-types/input/input.config';
import { ButtonComponent } from '../app/components/component-types/button/button.component';
import { buttonComponentConfig } from '../app/components/component-types/button/button.config';
import { LeverComponent } from '../app/components/component-types/lever/lever.component';
import { leverComponentConfig } from '../app/components/component-types/lever/lever.config';
import { Direction } from '../app/utils/direction';

/** AndComponent with the given port count, rotation, and grid position. */
export function makeAnd(
  numInputs = 2,
  direction: Direction = Direction.E,
  px = 0,
  py = 0
): AndComponent {
  const comp = new AndComponent({
    direction: andComponentConfig.options.direction.clone(direction),
    numInputs: andComponentConfig.options.numInputs.clone(numInputs)
  });
  comp.position.set(px, py);
  return comp;
}

/** NotComponent with the given rotation. */
export function makeNot(direction: Direction = Direction.E): NotComponent {
  return new NotComponent({
    direction: notComponentConfig.options.direction.clone(direction)
  });
}

/** Wire at half-grid position (gx+0.5, gy+0.5) with the given direction and length. */
export function makeWire(
  gx: number,
  gy: number,
  dir: WireDirection,
  length = 4
): Wire {
  const w = new Wire(dir, length);
  w.position.set(gx + 0.5, gy + 0.5);
  return w;
}

/** InputComponent plug with the given index. */
export function makeInput(index = 0): InputComponent {
  return new InputComponent({
    direction: inputComponentConfig.options.direction.clone(),
    label: inputComponentConfig.options.label.clone(''),
    index: inputComponentConfig.options.index.clone(index)
  });
}

/** ButtonComponent at the given grid position. */
export function makeButton(px = 0, py = 0): ButtonComponent {
  const button = new ButtonComponent({
    direction: buttonComponentConfig.options.direction.clone()
  });
  button.position.set(px, py);
  return button;
}

/** LeverComponent at the given grid position. */
export function makeLever(px = 0, py = 0): LeverComponent {
  const lever = new LeverComponent({
    direction: leverComponentConfig.options.direction.clone()
  });
  lever.position.set(px, py);
  return lever;
}

/** Minimal FederatedPointerEvent stub whose getLocalPosition returns the given point. */
export function makeMoveEvent(x: number, y: number): FederatedPointerEvent {
  return {
    getLocalPosition: () => new Point(x, y)
  } as unknown as FederatedPointerEvent;
}
