import { Signal, Type } from '@angular/core';
import { Subject } from 'rxjs';
import { TranslationKey } from '../translation/translation-key.model';

export interface ComponentOptionInput<T> {
  readonly option: Signal<ComponentOption<T>>;
  readonly commit: Signal<(value: T) => void>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class ComponentOption<T = any> {
  public abstract readonly label: TranslationKey;
  public abstract readonly renderer: Type<ComponentOptionInput<T>>;
  public onChange$ = new Subject<T>();

  /**
   * When `true`, this option is omitted from the generic per-component settings
   * form ({@link ComponentSettingsComponent}). The value still round-trips
   * through the wire format — it is simply system-managed and never typed by
   * the user directly (e.g. a plug's `index`, driven by the Ports panel).
   */
  public inspectorHidden = false;

  private _value: T;

  protected constructor(value: T) {
    this._value = value;
  }

  get value(): T {
    return this._value;
  }

  set value(value: T) {
    this._value = value;
    this.onChange$.next(value);
  }

  /**
   * Marks this option as hidden from the inspector and returns `this` for
   * fluent use in config definitions (`new NumberComponentOption(...).hideFromInspector()`).
   */
  public hideFromInspector(): this {
    this.inspectorHidden = true;
    return this;
  }

  /**
   * Clones this option (optionally with a new value). Concrete subclasses
   * implement {@link cloneWithValue}; this template method then copies
   * cross-cutting flags ({@link inspectorHidden}) so they survive every
   * clone-based path (deserialization, placement ghosts). Returns the
   * polymorphic `this` type so callers keep the concrete option subtype.
   */
  public clone(initialValue?: T): this {
    const cloned = this.cloneWithValue(initialValue);
    cloned.inspectorHidden = this.inspectorHidden;
    return cloned as this;
  }

  protected abstract cloneWithValue(initialValue?: T): ComponentOption<T>;
}
