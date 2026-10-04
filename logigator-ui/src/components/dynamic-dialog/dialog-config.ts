import { InputSignalWithTransform, Signal } from '@angular/core';

/**
 * The value an `input()` signal field `F` accepts, or `never` when `F` is not
 * an input signal. The `any` mirrors Angular's own
 * `ɵUnwrapInputSignalWriteType`: `InputSignalWithTransform`'s parameters are
 * invariant, so a concrete `InputSignal<number>` is *not* assignable to an
 * `<unknown, unknown>` probe and only the bivariant `any` matches.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type InputValue<F> =
  F extends InputSignalWithTransform<any, infer W> ? W : never;
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * The `input()` signal members of a component `C`, mapped to the value each
 * accepts. Non-input members are dropped.
 */
export type DialogInputs<C> = {
  [K in keyof C as [InputValue<C[K]>] extends [never] ? never : K]?: InputValue<
    C[K]
  >;
};

/**
 * Configuration for an imperatively-opened dialog, provided in the child
 * component's injector so it can read `inject(DialogConfig).data`.
 *
 * `D` is the `data` payload type, `C` the opened component that types
 * `inputValues`. Both default loose, for sites reading the config generically.
 */
export class DialogConfig<D = unknown, C = unknown> {
  header?: string;
  width?: string;
  modal?: boolean;
  closable?: boolean;
  /** ARIA label for the close button; defaults to `'Close'`. Localize it. */
  closeLabel?: string;
  data?: D;
  inputValues?: DialogInputs<C>;
  dismissableMask?: boolean;
  style?: Record<string, string>;
  /**
   * Renders a viewport-filling takeover instead of a centred card, ignoring
   * `width`/`style`. A `Signal` keeps it live, so an open dialog switches
   * presentation when the signal flips.
   */
  fullscreen?: boolean | Signal<boolean>;
  /**
   * Overrides the body's default scroll and padding classes, for content that
   * manages its own. Its flex sizing (`min-h-0 grow`) always stays.
   */
  bodyClass?: string;
  /**
   * Opaque identifier reported to an {@link LgDialogTelemetry} observer on
   * open and close. Omit it and the dialog is not reported at all.
   */
  telemetryId?: string;
}
