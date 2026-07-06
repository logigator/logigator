import { beforeEach, describe, expect, it } from 'vitest';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { makeSwitch } from '../../../../testing/factories';
import { BuiltInComponentType } from '../../component-type.enum';
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

  it('clearSimState resets the on state', () => {
    const switchComp = makeSwitch();
    switchComp.setOn(true);

    switchComp.clearSimState();

    expect(switchComp.isOn).toBe(false);
    switchComp.destroy({ children: true });
  });
});
