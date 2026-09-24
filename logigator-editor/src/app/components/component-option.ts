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
   * Omits the option from the settings form. The value still round-trips
   * through the wire format; it is system-managed rather than user-typed (a
   * plug's `index`, driven by the Ports panel).
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

  /** Returns `this`, for fluent use in config definitions. */
  public hideFromInspector(): this {
    this.inspectorHidden = true;
    return this;
  }

  /**
   * Subclasses implement {@link cloneWithValue}; this copies the cross-cutting
   * flags on top, so they survive deserialization and placement ghosts alike.
   * Returns the polymorphic `this` type, keeping the concrete subtype.
   */
  public clone(initialValue?: T): this {
    const cloned = this.cloneWithValue(initialValue);
    cloned.inspectorHidden = this.inspectorHidden;
    return cloned as this;
  }

  protected abstract cloneWithValue(initialValue?: T): ComponentOption<T>;
}
