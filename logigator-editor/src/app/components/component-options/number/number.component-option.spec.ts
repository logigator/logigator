import { describe, expect, it } from 'vitest';
import { NumberComponentOption } from './number.component-option';
import { clockComponentConfig } from '../../component-types/clock/clock.config';

const U32_MAX = 4294967295;

function makeOption(value: number): NumberComponentOption {
  return new NumberComponentOption('components.options.inputs', 2, 64, value);
}

describe('NumberComponentOption', () => {
  it('rounds and clamps on the setter', () => {
    const option = makeOption(4);

    option.value = 5.4;
    expect(option.value).toBe(5);

    option.value = 5.5;
    expect(option.value).toBe(6);

    option.value = 100.7;
    expect(option.value).toBe(64);

    option.value = 1.2;
    expect(option.value).toBe(2);
  });

  it('rounds and clamps in the constructor, so clones cannot carry a fraction', () => {
    expect(makeOption(4.8).value).toBe(5);
    // The path `Component.deserialize` takes for every stored option value.
    expect(makeOption(4).clone(4.8).value).toBe(5);
  });

  it('treats a non-number as min and the infinities as the bounds', () => {
    expect(makeOption(Number.NaN).value).toBe(2);
    expect(makeOption(Number.POSITIVE_INFINITY).value).toBe(64);
    expect(makeOption(Number.NEGATIVE_INFINITY).value).toBe(2);

    const option = makeOption(4);
    option.value = Number.NaN;
    expect(option.value).toBe(2);
  });

  // A fractional clock speed reached the engine's `u32` half-cycle field and
  // made it reject the whole board; a project saved with one still loads.
  it('keeps the clock speed inside the range the engine accepts', () => {
    const speed = clockComponentConfig.options.speed;

    expect(speed.max).toBeLessThanOrEqual(U32_MAX);
    expect(speed.clone(1.9).value).toBe(2);
    expect(speed.clone(Number.MAX_SAFE_INTEGER).value).toBe(speed.max);
  });
});
