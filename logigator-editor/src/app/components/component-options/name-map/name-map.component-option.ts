import { Type } from '@angular/core';
import { canonicalNameMap, NameMap } from '@logigator/core';
import { ComponentOption } from '../../component-option';
import { TranslationKey } from '../../../translation/translation-key.model';
import { NameMapOptionInputComponent } from './name-map-option-input.component';
import type { NameMapEditor } from './name-map-editor';

export interface NameMapComponentOptionConfig {
  /** Longest name stored for any one key. */
  maxLength: number;
  /** Characters stripped from every name on write; none when omitted. */
  forbiddenChars?: RegExp;
}

/**
 * Optional custom names for a fixed set of keys, edited together in one
 * dialog. The value is immutable and canonical — frozen, trimmed, empty names
 * dropped, keys in schema order — and every write replaces it with a new
 * object, so clone, paste and undo never alias it and equal name sets are
 * equal by value.
 *
 * What the dialog shows is the owner's knowledge, not the option's: which
 * keys are present right now ({@link attachKeys}) and the component that edits
 * them ({@link attachEditor}). Without an editor the option has no settings
 * row. A name whose key is not shown stays in the value.
 */
export class NameMapComponentOption extends ComponentOption<NameMap> {
  public readonly renderer = NameMapOptionInputComponent;
  public readonly maxLength: number;
  public readonly forbiddenChars: RegExp | undefined;

  /** The keys the dialog lists; every key until {@link attachKeys}. */
  public visibleKeys: () => readonly string[] = () => this.keys;
  /** The dialog body; supplied via {@link attachEditor}. */
  public editor: Type<NameMapEditor> | null = null;

  constructor(
    public readonly label: TranslationKey,
    /** Every key a name may be set for, in order. */
    public readonly keys: readonly string[],
    defaultValue: NameMap,
    config: NameMapComponentOptionConfig
  ) {
    super(
      NameMapComponentOption.sanitize(
        defaultValue,
        keys,
        config.maxLength,
        config.forbiddenChars
      )
    );
    this.maxLength = config.maxLength;
    this.forbiddenChars = config.forbiddenChars;
  }

  /**
   * Each name stripped of forbidden characters, trimmed and clamped, then the
   * whole map canonicalised and frozen. Anything that is not a name map
   * becomes the empty one.
   */
  private static sanitize(
    value: unknown,
    keys: readonly string[],
    maxLength: number,
    forbiddenChars: RegExp | undefined
  ): NameMap {
    const cleaned: Record<string, string> = {};
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      for (const [key, name] of Object.entries(value)) {
        if (typeof name !== 'string') continue;
        const stripped = forbiddenChars
          ? name.replace(forbiddenChars, '')
          : name;
        cleaned[key] = stripped.trim().slice(0, maxLength);
      }
    }
    return Object.freeze(canonicalNameMap(keys, cleaned));
  }

  override set value(value: NameMap) {
    super.value = this._sanitize(value);
  }

  override get value(): NameMap {
    return super.value;
  }

  override isCurrent(value: NameMap): boolean {
    const current = Object.entries(this.value);
    const next = Object.entries(this._sanitize(value));
    return (
      current.length === next.length &&
      current.every(
        ([key, name], i) => next[i][0] === key && next[i][1] === name
      )
    );
  }

  /** Links the keys the dialog lists right now, in the order it lists them. */
  public attachKeys(keys: () => readonly string[]): this {
    this.visibleKeys = keys;
    return this;
  }

  /** Names the component the dialog hosts to edit the names. */
  public attachEditor(editor: Type<NameMapEditor>): this {
    this.editor = editor;
    return this;
  }

  /**
   * Carries both attachments, so a config's option passes its editor on to
   * every instance. An owner whose key resolver reads its own state attaches
   * it again in its constructor, which every clone path runs.
   */
  protected cloneWithValue(initialValue?: NameMap): NameMapComponentOption {
    const cloned = new NameMapComponentOption(
      this.label,
      this.keys,
      initialValue ?? this.value,
      { maxLength: this.maxLength, forbiddenChars: this.forbiddenChars }
    );
    cloned.visibleKeys = this.visibleKeys;
    cloned.editor = this.editor;
    return cloned;
  }

  private _sanitize(value: unknown): NameMap {
    return NameMapComponentOption.sanitize(
      value,
      this.keys,
      this.maxLength,
      this.forbiddenChars
    );
  }
}
