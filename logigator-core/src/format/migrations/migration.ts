import { ComponentMeta } from '../../catalog/component-meta';
import { ComponentType } from '../../model/component-type.enum';

/**
 * What a migration is allowed to reach for. A migration MAY read a component
 * type's catalog data and report progress, but MUST NOT build render objects —
 * it is a document-to-document transform. Decoding the legacy positional format
 * into named options inherently needs the option schemas and the legacy slot
 * map; that is the only reason `catalog` is here. Native version→version
 * migrations are pure data transforms and ignore this context.
 */
export interface MigrationContext {
  /** A built-in's meta, or `undefined` for a custom or unknown type id. */
  catalog: (type: ComponentType) => ComponentMeta | undefined;
  /**
   * Where progress and recoverable problems go. A plain sink rather than a
   * logger so both callers fit: the editor forwards to its `LoggingService`,
   * the server collects the warnings into the parse result it returns.
   */
  log: {
    info(message: string): void;
    warn(message: string): void;
  };
}

/**
 * One step in the file-format migration chain: transforms a document of version
 * `from` into a document of version `to`.
 */
export interface Migration<TIn = unknown, TOut = unknown> {
  readonly from: number;
  readonly to: number;
  migrate(input: TIn, ctx: MigrationContext): TOut;
}
