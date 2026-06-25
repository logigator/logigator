import { Type } from '@angular/core';
import { ComponentOption, ComponentOptionInput } from '../../component-option';
import { TranslationKey } from '../../../translation/translation-key.model';
import { MemoryDataOptionInputComponent } from './memory-data-option-input.component';

/**
 * Edits a word-addressed memory's contents in a hex-editor modal. The value is
 * the contents as an immutable base64 bit-packed blob (a string, so
 * clone/paste/undo never alias a mutable buffer); uninitialised cells read as
 * zero and the blob is stored trailing-zero-trimmed.
 *
 * The editing dimensions — bits per word and how many words — are not part of
 * the blob; the owning component supplies them as resolver closures via
 * {@link attachDimensions} after construction (so the link survives every clone
 * path, which goes through the component factory). Keeping the closures on the
 * owner's side is what keeps this option generic: it never knows, e.g., that a
 * ROM derives its word count as `2^addressSize`.
 */
export class MemoryDataComponentOption extends ComponentOption<string> {
  public readonly renderer: Type<ComponentOptionInput<string>> =
    MemoryDataOptionInputComponent;

  /** Bits per word; supplied by the owning component via {@link attachDimensions}. */
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
    return new MemoryDataComponentOption(this.label, initialValue ?? this.value);
  }
}