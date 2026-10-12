import { Type } from '@angular/core';
import { ComponentOption, ComponentOptionInput } from '../../component-option';
import { TranslationKey } from '../../../translation/translation-key.model';
import { base64ToBytes, countNonZeroWords } from '../../../utils/packed-buffer';
import { MemoryDataOptionInputComponent } from './memory-data-option-input.component';

/**
 * Edits a word-addressed memory's contents in a hex-editor modal. The value is
 * an immutable base64 bit-packed blob — a string, so clone/paste/undo never
 * alias a mutable buffer — stored trailing-zero-trimmed, with unset cells
 * reading as zero.
 *
 * The dimensions are not part of the blob: the owner supplies them as resolver
 * closures via {@link attachDimensions} — a config's `bindOptions`, applied to
 * the config's options and to every instance's — which keeps this option
 * generic: it never knows that a ROM derives its word count as
 * `2^addressSize`. A clone starts unlinked.
 */
export class MemoryDataComponentOption extends ComponentOption<string> {
  public readonly renderer: Type<ComponentOptionInput<string>> =
    MemoryDataOptionInputComponent;

  /** Bits per word; supplied via {@link attachDimensions}. */
  public wordSize: () => number = () => 1;
  /** Number of addressable words; supplied via {@link attachDimensions}. */
  public wordCount: () => number = () => 0;

  // The last count and what it was taken of; the settings row asks on every
  // change detection.
  private _count: {
    value: string;
    wordSize: number;
    wordCount: number;
    nonZero: number;
  } | null = null;

  constructor(
    public readonly label: TranslationKey,
    defaultValue = ''
  ) {
    super(defaultValue);
  }

  /** How many of the {@link wordCount} words hold a set bit. */
  public nonZeroWords(): number {
    const value = this.value;
    const wordSize = this.wordSize();
    const wordCount = this.wordCount();
    const last = this._count;
    if (
      last?.value === value &&
      last.wordSize === wordSize &&
      last.wordCount === wordCount
    ) {
      return last.nonZero;
    }
    const nonZero = countNonZeroWords(
      base64ToBytes(value),
      wordSize,
      wordCount
    );
    this._count = { value, wordSize, wordCount, nonZero };
    return nonZero;
  }

  /** Links the live editing dimensions so the editor knows the table shape. */
  public attachDimensions(
    wordSize: () => number,
    wordCount: () => number
  ): this {
    this.wordSize = wordSize;
    this.wordCount = wordCount;
    return this;
  }

  protected cloneWithValue(initialValue?: string): MemoryDataComponentOption {
    return new MemoryDataComponentOption(
      this.label,
      initialValue ?? this.value
    );
  }
}
