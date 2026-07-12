import { beforeEach, describe, expect, it } from 'vitest';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { makeSwitch } from '../../../../testing/factories';
import { BuiltInComponentType } from '../../component-type.enum';
import { Direction } from '../../../utils/direction';
import { switchComponentConfig } from './switch.config';

describe('SwitchComponent', () => {
  beforeEach(() => {
    configureTestBed();
  });

  it('has the SWITCH type id (201, mirroring legacy)', () => {
    expect(switchComponentConfig.type).toBe(BuiltInComponentType.SWITCH);
    expect(switchComponentConfig.type).toBe(201);
  });

  it('exposes exactly one output and no inputs', () => {
    const switchComp = makeSwitch();
    expect(switchComp.numInputs).toBe(0);
    expect(switchComp.numOutputs).toBe(1);
    switchComp.destroy({ children: true });
  });

  it('starts off and toggles', () => {
    const switchComp = makeSwitch();
    expect(switchComp.isOn).toBe(false);

    switchComp.toggle();
    expect(switchComp.isOn).toBe(true);
    expect(switchComp.children.length).toBeGreaterThan(0);

    switchComp.toggle();
    expect(switchComp.isOn).toBe(false);

    switchComp.destroy({ children: true });
  });

  it('keeps the body upright while only the output stub rotates', () => {
    // axis/sign: which grid axis the single output port leaves the body on, and
    // in which direction, once the switch is turned to `dir`.
    const cases: { dir: Direction; axis: 'x' | 'y'; sign: 1 | -1 }[] = [
      { dir: Direction.E, axis: 'x', sign: 1 },
      { dir: Direction.S, axis: 'y', sign: 1 },
      { dir: Direction.W, axis: 'x', sign: -1 },
      { dir: Direction.N, axis: 'y', sign: -1 }
    ];

    for (const { dir, axis, sign } of cases) {
      const switchComp = makeSwitch();
      switchComp.direction = dir;

      // The body graphics is the first child drawn; its counter-rotation must
      // cancel the container rotation so the square (and its on/off bar) renders
      // upright on screen in every direction.
      const worldRotation = switchComp.children[0].rotation + switchComp.rotation;
      expect(Math.sin(worldRotation)).toBeCloseTo(0);
      expect(Math.cos(worldRotation)).toBeCloseTo(1);

      // The lone output port, by contrast, does rotate: it sits one grid unit
      // past the body centre along the chosen direction axis.
      const [output] = switchComp.connectionPoints;
      const body = switchComp.bodyGridBounds;
      const cx = body.x + body.width / 2;
      const cy = body.y + body.height / 2;
      if (axis === 'x') {
        expect(output.y).toBeCloseTo(cy);
        expect(output.x - cx).toBeCloseTo(sign);
      } else {
        expect(output.x).toBeCloseTo(cx);
        expect(output.y - cy).toBeCloseTo(sign);
      }

      switchComp.destroy({ children: true });
    }
  });

  it('clearSimState resets the on state', () => {
    const switchComp = makeSwitch();
    switchComp.setOn(true);

    switchComp.clearSimState();

    expect(switchComp.isOn).toBe(false);
    switchComp.destroy({ children: true });
  });
});
