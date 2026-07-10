import { InputSignalWithTransform } from '@angular/core';

/**
 * The value an `input()` signal field `F` accepts (its write / transform-input
 * type, matching what `ComponentRef.setInput` takes), or `never` for any field
 * that is not an input signal.
 *
 * The `any` mirrors Angular's own `ɵUnwrapInputSignalWriteType`:
 * `InputSignalWithTransform`'s type parameters sit in invariant/contravariant
 * positions (via its `[SIGNAL]` node), so a concrete `InputSignal<number>` is
 * *not* assignable to an `<unknown, unknown>` probe — only the bivariant `any`
 * matches every input signal. `InputSignal<T>` is `InputSignalWithTransform<T,
 * T>`, so both plain and transformed inputs are covered.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type InputValue<F> =
  F extends InputSignalWithTransform<any, infer W> ? W : never;
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * The `input()` signal members of a component `C`, mapped to the value each
 * accepts, so {@link DialogConfig.inputValues} is checked against the opened
 * component's inputs. Non-input members (outputs, plain fields, methods) are
 * dropped.
 */
export type DialogInputs<C> = {
  [K in keyof C as [InputValue<C[K]>] extends [never] ? never : K]?: InputValue<
    C[K]
  >;
};

/**
 * Configuration for an imperatively-opened dialog ({@link DialogService.open}).
 * Provided in the child component's injector so the opened component can read
 * `inject(DialogConfig).data`.
 *
 * `D` is the `data` payload type; `C` the opened component, which types
 * `inputValues` against that component's `input()` signals. Both default to
 * loose types for injection sites that read the config back generically.
 */
export class DialogConfig<D = unknown, C = unknown> {
  header?: string;
  width?: string;
  modal?: boolean;
  closable?: boolean;
  data?: D;
  inputValues?: DialogInputs<C>;
  dismissableMask?: boolean;
  style?: Record<string, string>;
}
