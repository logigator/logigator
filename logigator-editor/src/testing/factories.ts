import { Point } from 'pixi.js';
import { PointerInput } from '../app/rendering/interaction/pointer-input';
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
import { SwitchComponent } from '../app/components/component-types/switch/switch.component';
import { switchComponentConfig } from '../app/components/component-types/switch/switch.config';
import { RomComponent } from '../app/components/component-types/rom/rom.component';
import { romComponentConfig } from '../app/components/component-types/rom/rom.config';
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

/** SwitchComponent at the given grid position. */
export function makeSwitch(px = 0, py = 0): SwitchComponent {
  const switchComp = new SwitchComponent({
    direction: switchComponentConfig.options.direction.clone()
  });
  switchComp.position.set(px, py);
  return switchComp;
}

/** RomComponent with the given table shape, contents blob, and grid position. */
export function makeRom(
  addressSize = 2,
  wordSize = 4,
  data = '',
  px = 0,
  py = 0
): RomComponent {
  const rom = new RomComponent({
    direction: romComponentConfig.options.direction.clone(),
    wordSize: romComponentConfig.options.wordSize.clone(wordSize),
    addressSize: romComponentConfig.options.addressSize.clone(addressSize),
    data: romComponentConfig.options.data.clone(data)
  });
  rom.position.set(px, py);
  return rom;
}

/** PointerInput sample at the given grid position (global mirrors it). */
export function makeMoveInput(x: number, y: number): PointerInput {
  return {
    pointerId: 1,
    pointerType: 'mouse',
    global: new Point(x, y),
    grid: new Point(x, y)
  };
}
