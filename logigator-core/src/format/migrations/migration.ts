import { ComponentMeta } from '../../catalog/component-meta';
import { ComponentType } from '../../model/component-type.enum';

/**
 * What a migration is allowed to reach for. A migration is a document-to-
 * document transform: it may read catalog data and report progress, never build
 * render objects. `catalog` is here only because decoding the positional format
 * into named options needs the option schemas and the legacy slot map.
 */
export interface MigrationContext {
  /** A built-in's meta, or `undefined` for a custom or unknown type id. */
  catalog: (type: ComponentType) => ComponentMeta | undefined;
  /**
   * Where progress and recoverable problems go. A plain sink rather than a
   * logger, so a consumer can forward it or collect it as it likes.
   */
  log: {
    info(message: string): void;
    warn(message: string): void;
  };
}

/** One step in the migration chain: a document of version `from` into `to`. */
export interface Migration<TIn = unknown, TOut = unknown> {
  readonly from: number;
  readonly to: number;
  migrate(input: TIn, ctx: MigrationContext): TOut;
}
