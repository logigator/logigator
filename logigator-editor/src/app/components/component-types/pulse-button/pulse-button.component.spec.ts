import { beforeEach, describe, expect, it } from 'vitest';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { makePulseButton } from '../../../../testing/factories';
import { BuiltInComponentType } from '@logigator/core';
import { pulseButtonComponentConfig } from './pulse-button.config';

describe('PulseButtonComponent', () => {
  beforeEach(() => {
    configureTestBed();
  });

  it('has the PULSE_BUTTON type id (200, mirroring legacy)', () => {
    expect(pulseButtonComponentConfig.type).toBe(
      BuiltInComponentType.PULSE_BUTTON
    );
    expect(pulseButtonComponentConfig.type).toBe(200);
  });

  it('exposes exactly one output and no inputs', () => {
    const button = makePulseButton();
    expect(button.numInputs).toBe(0);
    expect(button.numOutputs).toBe(1);
    button.destroy({ children: true });
  });

  it('starts unpressed and draws a pressed slot', () => {
    const button = makePulseButton();
    expect(button.isActive(0)).toBe(false);

    button.setActive(0, true);
    expect(button.isActive(0)).toBe(true);
    expect(button.children.length).toBeGreaterThan(0);

    button.destroy({ children: true });
  });

  it('clearSimState resets the pressed state', () => {
    const button = makePulseButton();
    button.setActive(0, true);

    button.clearSimState();

    expect(button.isActive(0)).toBe(false);
    button.destroy({ children: true });
  });
});
