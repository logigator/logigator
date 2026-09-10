import { ComponentOption } from '../../component-option';
import { TranslationKey } from '../../../translation/translation-key.model';
import { NumberOptionInputComponent } from './number-option-input.component';

/**
 * Snaps a value into the option's integer domain: fractions round, the result
 * clamps to `[min, max]`, and anything that is not a number at all falls back
 * to `min`. Every numeric option ends up in an integer field downstream — the
 * simulation engine reads the ones it receives as `u32` and rejects a float
 * outright — so no path may store one. The coercion covers values that never
 * passed a setter, e.g. a hand-edited file.
 */
function normalize(value: number, min: number, max: number): number {
  const rounded = Math.round(Number(value));
  if (Number.isNaN(rounded)) {
    return min;
  }
  return Math.min(max, Math.max(min, rounded));
}

export class NumberComponentOption extends ComponentOption<number> {
  public readonly renderer = NumberOptionInputComponent;

  constructor(
    public readonly label: TranslationKey,
    public readonly min: number,
    public readonly max: number,
    defaultValue: number
  ) {
    // Normalized here too, not just in the setter: every clone-based path
    // (deserialization, the v0 decode, placement ghosts) reaches the value
    // through this constructor and would otherwise bypass the setter.
    super(normalize(defaultValue, min, max));
  }

  override set value(value: number) {
    super.value = normalize(value, this.min, this.max);
  }

  override get value(): number {
    return super.value;
  }

  protected cloneWithValue(initialValue?: number): NumberComponentOption {
    return new NumberComponentOption(
      this.label,
      this.min,
      this.max,
      initialValue ?? this.value
    );
  }
}
