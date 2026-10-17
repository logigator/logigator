import { InputSignal, ModelSignal, OutputRef } from '@angular/core';
import { NameMap } from '@logigator/core';

/**
 * The dialog body a name-map option's owner supplies through
 * `NameMapComponentOption.attachEditor`. Only the owner knows how its keys look
 * and what their default names are, so the dialog hosts this component and
 * keeps the frame — title, Save, Cancel — to itself.
 *
 * The dialog binds the draft two-way and saves whatever the editor last wrote
 * to it. The draft may hold untrimmed or empty names: the option sanitizes on
 * save, so the editor need not.
 */
export interface NameMapEditor {
  /** The keys to offer, in the order the owner lists them. */
  readonly keys: InputSignal<readonly string[]>;
  /** The draft, rewritten as a whole on every edit. */
  readonly names: ModelSignal<NameMap>;
  /** The longest name the option stores. */
  readonly maxLength: InputSignal<number>;
  /** Asks the dialog to save, as its Save button does. */
  readonly save: OutputRef<void>;
}
