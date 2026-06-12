import { beforeEach, describe, expect, it } from 'vitest';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { makeLever } from '../../../../testing/factories';
import { BuiltInComponentType } from '../../component-type.enum';
import { leverComponentConfig } from './lever.config';

describe('LeverComponent', () => {
  beforeEach(() => {
    configureTestBed();
  });

  it('has the LEVER type id (201, mirroring legacy)', () => {
    expect(leverComponentConfig.type).toBe(BuiltInComponentType.LEVER);
    expect(leverComponentConfig.type).toBe(201);
  });

  it('exposes exactly one output and no inputs', () => {
    const lever = makeLever();
    expect(lever.numInputs).toBe(0);
    expect(lever.numOutputs).toBe(1);
    lever.destroy({ children: true });
  });

  it('starts off and toggles', () => {
    const lever = makeLever();
    expect(lever.isOn).toBe(false);

    lever.toggle();
    expect(lever.isOn).toBe(true);
    expect(lever.children.length).toBeGreaterThan(0);

    lever.toggle();
    expect(lever.isOn).toBe(false);

    lever.destroy({ children: true });
  });

  it('clearSimState resets the on state', () => {
    const lever = makeLever();
    lever.setOn(true);

    lever.clearSimState();

    expect(lever.isOn).toBe(false);
    lever.destroy({ children: true });
  });
});
