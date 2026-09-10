import { Type } from '@angular/core';
import { ComponentOption, ComponentOptionInput } from '../../component-option';
import { TranslationKey } from '../../../translation/translation-key.model';
import { MemoryDataOptionInputComponent } from './memory-data-option-input.component';

/**
 * Edits a word-addressed memory's contents in a hex-editor modal. The value is
 * an immutable base64 bit-packed blob — a string, so clone/paste/undo never
 * alias a mutable buffer — stored trailing-zero-trimmed, with unset cells
 * reading as zero.
 *
 * The dimensions are not part of the blob: the owning component supplies them
 * as resolver closures via {@link attachDimensions}, which survives every clone
 * path and keeps this option generic — it never knows that a ROM derives its
 * word count as `2^addressSize`.
 */
export class MemoryDataComponentOption extends ComponentOption<string> {
  public readonly renderer: Type<ComponentOptionInput<string>> =
    MemoryDataOptionInputComponent;

  /** Bits per word; supplied via {@link attachDimensions}. */
  public wordSize: () => number = () => 1;
  /** Number of addressable words; supplied via {@link attachDimensions}. */
  public wordCount: () => number = () => 0;

  constructor(
    public readonly label: TranslationKey,
    defaultValue = ''
  ) {
    super(defaultValue);
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
