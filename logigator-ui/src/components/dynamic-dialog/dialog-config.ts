/**
 * Configuration for an imperatively-opened dialog ({@link DialogService.open}).
 * Mirrors the slice of PrimeNG's `DynamicDialogConfig` the editor uses; it is
 * provided in the child component's injector so the opened component can read
 * `inject(DialogConfig).data`.
 *
 * `data` is typed `unknown` (the library forbids `any`); read sites narrow it
 * with a cast.
 */
export class DialogConfig<D = unknown> {
  header?: string;
  width?: string;
  modal?: boolean;
  closable?: boolean;
  data?: D;
  inputValues?: Record<string, unknown>;
  dismissableMask?: boolean;
  style?: Record<string, string>;
}
