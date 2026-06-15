import { signal, Signal, WritableSignal } from '@angular/core';
import { TranslationKey } from '../translation/translation-key.model';

/**
 * A single boolean editor preference. Holds its value as a signal and reports
 * changes through `onChange`; persistence is centralized in
 * `EditorSettingsService` so all settings share one storage entry.
 */
export class EditorSetting {
  private readonly _value: WritableSignal<boolean>;
  public readonly value: Signal<boolean>;

  constructor(
    public readonly key: string,
    public readonly labelKey: TranslationKey,
    initialValue: boolean,
    private readonly onChange: () => void
  ) {
    this._value = signal(initialValue);
    this.value = this._value.asReadonly();
  }

  public set(value: boolean): void {
    this._value.set(value);
    this.onChange();
  }

  public toggle(): void {
    this.set(!this._value());
  }
}
