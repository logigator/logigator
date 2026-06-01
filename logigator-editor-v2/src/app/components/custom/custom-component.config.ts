import { ComponentConfig } from '../component-config.model';
import { ComponentType } from '../component-type.enum';
import { ComponentCategory } from '../component-category.enum';
import { ComponentOption } from '../component-option';
import { DirectionComponentOption } from '../component-options/direction/direction.component-option';
import { TranslationKey } from '../../translation/translation-key.model';
import { CustomComponentDefinition } from './custom-component-definition.model';
import { CustomComponent } from './custom-component';

/**
 * Option set for every custom component instance. Unlike built-ins, a custom
 * component's port counts come from its {@link CustomComponentDefinition}, never
 * from the element — so the only per-instance option is `direction` (Invariant A
 * in the custom-components plan).
 */
export interface CustomComponentOptions {
	[key: string]: ComponentOption;
	direction: DirectionComponentOption;
}

/**
 * Builds the single {@link ComponentConfig} that backs a custom component type.
 * One config per definition; it is registered into {@link ComponentProviderService}
 * by the registry so every existing resolver (serializer, actions, palette)
 * keeps working through the same `getComponent(t)` path.
 *
 * **Master** configs are `USER` category (they populate the palette); **snapshot**
 * configs are `HIDDEN` (resolvable by `getComponent(t)` but never listed — you
 * place *from* a master, and a project's `t`s reference snapshots).
 *
 * The config is a **live view** of its definition: `symbol`/`name`/`description`
 * are getters reading `def`. For a master that means edits propagate to the
 * palette without rebuilding the config; for a (frozen) snapshot they are simply
 * fixed. `create` closes over both `def` and the config itself, so a built
 * instance exposes this exact object (hence `component.config.type === def.typeId`,
 * which the serializer relies on).
 */
export function buildCustomComponentConfig(
	def: CustomComponentDefinition
): ComponentConfig<CustomComponentOptions> {
	const config: ComponentConfig<CustomComponentOptions> = {
		// Custom type ids are plain numbers >= CUSTOM_TYPE_ID_BASE, not members of
		// the closed built-in enum — cast to satisfy the shared config contract.
		type: def.typeId as unknown as ComponentType,
		category:
			def.kind === 'master' ? ComponentCategory.USER : ComponentCategory.HIDDEN,
		get symbol(): string {
			return def.symbol;
		},
		// A custom component's name/description are user strings, not translation
		// keys; the cast keeps the config contract while built-ins stay type-safe.
		get name(): TranslationKey {
			return def.name as unknown as TranslationKey;
		},
		get description(): TranslationKey {
			return def.description as unknown as TranslationKey;
		},
		options: {
			direction: new DirectionComponentOption()
		},
		create: (options) => new CustomComponent(options, def, config)
	};
	return config;
}
