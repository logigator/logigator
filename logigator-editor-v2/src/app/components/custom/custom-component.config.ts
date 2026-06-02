import { ComponentConfig, LocalizableText } from '../component-config.model';
import { ComponentCategory } from '../component-category.enum';
import { ComponentOption } from '../component-option';
import { DirectionComponentOption } from '../component-options/direction/direction.component-option';
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
 * Builds the single {@link ComponentConfig} that backs a custom component type —
 * one config per definition, resolved through the same `getComponent(t)` path as
 * built-ins.
 *
 * **Master** configs are `USER` category (they populate the palette); **snapshot**
 * configs are `HIDDEN` (resolvable by `getComponent(t)` but never listed — you
 * place *from* a master, and a project's `t`s reference snapshots).
 *
 * The config is a **live view** of its definition: `symbol`/`name`/`description`
 * are getters reading `def`, so a master's edits surface in the palette without
 * rebuilding the config and a frozen snapshot's stay fixed. `create` closes over
 * both `def` and the config itself, so a built instance exposes this exact object
 * (hence `component.config.type === def.typeId`, which the serializer relies on).
 */
export function buildCustomComponentConfig(
	def: CustomComponentDefinition
): ComponentConfig<CustomComponentOptions> {
	const config: ComponentConfig<CustomComponentOptions> = {
		type: def.typeId,
		category:
			def.kind === 'master' ? ComponentCategory.USER : ComponentCategory.HIDDEN,
		get symbol(): string {
			return def.symbol;
		},
		// User-authored strings, shown verbatim (the literal arm of LocalizableText)
		// rather than resolved against the translation schema.
		get name(): LocalizableText {
			return { literal: def.name };
		},
		get description(): LocalizableText {
			return { literal: def.description };
		},
		options: {
			direction: new DirectionComponentOption()
		},
		create: (options) => new CustomComponent(options, def, config)
	};
	return config;
}
