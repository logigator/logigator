import { inject } from '@angular/core';
import { DialogConfig } from './dialog-config';
import { DialogRef } from './dialog-ref';

/**
 * Base class for a component opened through {@link DialogService.open}. Writing
 * `extends LgDialogContent<Data, Result>` names the dialog's contract once and
 * gets two things from it:
 *
 * - typed {@link dialogData} (the `data` payload passed in `open`'s config) and
 *   {@link dialogRef} (whose `close(result)` takes `Result`), so the component
 *   needs no cast on `config.data` and no `satisfies` on the close value;
 * - inference at the call site — {@link DialogService.open} reads `Data`/`Result`
 *   off the component type, so callers pass no type arguments and `open`'s
 *   `config.data` is checked against the component's own `Data`.
 *
 * `Data`/`Result` default to `void`: a dialog that takes no payload extends
 * `LgDialogContent<void, TheResult>` (and `open` then rejects a stray `data`), a
 * dialog that returns nothing extends `LgDialogContent<TheData>`.
 *
 * The `inject()` calls run in field initializers, which execute within the
 * component's injection context during construction, so no decorator is needed
 * on this base.
 */
export abstract class LgDialogContent<Data = void, Result = void> {
  protected readonly dialogRef = inject(DialogRef) as DialogRef<Result>;
  protected readonly dialogData = inject(DialogConfig).data as Data | undefined;
}

/**
 * The `[Data, Result]` a dialog component declares via {@link LgDialogContent},
 * or `[unknown, unknown]` for a component that does not extend it.
 *
 * Both type parameters are inferred together (rather than fixing the unwanted
 * one to `unknown`): `dialogRef: DialogRef<Result>` makes `Result` invariant, so
 * a `LgDialogContent<Data, unknown>` probe would fail to match and fall through
 * to the default, silently dropping all `data` type-checking.
 */
type DialogContractOf<C> =
  C extends LgDialogContent<infer Data, infer Result>
    ? [Data, Result]
    : [unknown, unknown];

/**
 * The `data` payload type a dialog component declares via {@link LgDialogContent}
 * (its `Data` argument), or `unknown` for a component that does not extend it.
 */
export type DialogDataOf<C> = DialogContractOf<C>[0];

/**
 * The result type a dialog component closes with, declared via
 * {@link LgDialogContent} (its `Result` argument), or `unknown` for a component
 * that does not extend it.
 */
export type DialogResultOf<C> = DialogContractOf<C>[1];
