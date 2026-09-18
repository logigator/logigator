import { beforeEach, describe, expect, it } from 'vitest';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { makeLed } from '../../../../testing/factories';
import { LedComponent } from './led.component';

describe('LedComponent', () => {
  let led: LedComponent;

  beforeEach(() => {
    configureTestBed();
    led = makeLed();
  });

  it('lights from its input net while un-negated', () => {
    led.setSimulating(true);
    expect(led.isInputHigh(0)).toBe(false);

    led.setPortPowered(0, true);
    expect(led.isInputHigh(0)).toBe(true);
  });

  it('inverts a negated input: lit on a low net, dark on a powered one', () => {
    led.setPortNegated('in', 0, true);
    led.setSimulating(true);

    // The engine reports nothing for a net that never changes, so this is the
    // state the session starts in.
    expect(led.isInputHigh(0)).toBe(true);

    led.setPortPowered(0, true);
    expect(led.isInputHigh(0)).toBe(false);
  });

  it('stays dark outside a session, bubble or not', () => {
    led.setPortNegated('in', 0, true);
    expect(led.isInputHigh(0)).toBe(false);

    led.setSimulating(true);
    expect(led.isInputHigh(0)).toBe(true);

    led.setSimulating(false);
    expect(led.isInputHigh(0)).toBe(false);
  });
});
