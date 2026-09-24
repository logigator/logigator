import { inject } from '@angular/core';
import { DialogConfig } from './dialog-config';
import { DialogRef } from './dialog-ref';

/**
 * Base class for a component opened through {@link DialogService.open}.
 * `extends LgDialogContent<Data, Result>` names the dialog's contract once,
 * giving the component typed {@link dialogData} and {@link dialogRef} and
 * letting {@link DialogService.open} infer both at the call site, so callers
 * pass no type arguments and `open`'s `config.data` is checked.
 *
 * Both default to `void`: a dialog taking no payload extends
 * `LgDialogContent<void, TheResult>` and `open` then rejects a stray `data`.
 *
 * The `inject()` calls sit in field initializers, which run inside the
 * component's injection context, so this base needs no decorator.
 */
export abstract class LgDialogContent<Data = void, Result = void> {
  protected readonly dialogRef = inject(DialogRef) as DialogRef<Result>;
  protected readonly dialogData = inject(DialogConfig).data as Data | undefined;
}

/**
 * The `[Data, Result]` a dialog component declares via {@link LgDialogContent},
 * or `[unknown, unknown]` for a component that does not extend it. Both are
 * inferred together because `dialogRef: DialogRef<Result>` makes `Result`
 * invariant: a `LgDialogContent<Data, unknown>` probe would fail to match and
 * fall through to the default, silently dropping all `data` checking.
 */
type DialogContractOf<C> =
  C extends LgDialogContent<infer Data, infer Result>
    ? [Data, Result]
    : [unknown, unknown];

/** A dialog component's `Data`, or `unknown` when it declares none. */
export type DialogDataOf<C> = DialogContractOf<C>[0];

/** A dialog component's `Result`, or `unknown` when it declares none. */
export type DialogResultOf<C> = DialogContractOf<C>[1];
