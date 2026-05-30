import { ComponentProviderService } from '../../../components/component-provider.service';
import { LoggingService } from '../../../logging/logging.service';

/**
 * Services a migration is allowed to use. A migration MAY read the component
 * registry (config / option metadata) and log, but MUST NOT instantiate render
 * objects (`Component`/`Wire` PixiJS instances). Decoding the legacy positional
 * format into named options inherently needs the config schemas; that is the
 * only reason the registry is here. Native version→version migrations are pure
 * data transforms and ignore this context.
 */
export interface MigrationContext {
	componentProvider: ComponentProviderService;
	logging: LoggingService;
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
