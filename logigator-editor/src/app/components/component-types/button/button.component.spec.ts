import { beforeEach, describe, expect, it } from 'vitest';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { makeButton } from '../../../../testing/factories';
import { BuiltInComponentType } from '../../component-type.enum';
import { buttonComponentConfig } from './button.config';

describe('ButtonComponent', () => {
  beforeEach(() => {
    configureTestBed();
  });

  it('has the BUTTON type id (200, mirroring legacy)', () => {
    expect(buttonComponentConfig.type).toBe(BuiltInComponentType.BUTTON);
    expect(buttonComponentConfig.type).toBe(200);
  });

  it('exposes exactly one output and no inputs', () => {
    const button = makeButton();
    expect(button.numInputs).toBe(0);
    expect(button.numOutputs).toBe(1);
    button.destroy({ children: true });
  });

  it('starts unpressed and reacts to setPressed', () => {
    const button = makeButton();
    expect(button.pressed).toBe(false);

    button.setPressed(true);
    expect(button.pressed).toBe(true);
    expect(button.children.length).toBeGreaterThan(0);

    button.destroy({ children: true });
  });

  it('clearSimState resets the pressed state', () => {
    const button = makeButton();
    button.setPressed(true);

    button.clearSimState();

    expect(button.pressed).toBe(false);
    button.destroy({ children: true });
  });
});
