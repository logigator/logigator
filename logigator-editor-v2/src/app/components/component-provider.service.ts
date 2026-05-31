import { computed, Injectable, Signal, signal } from '@angular/core';
import { ComponentConfig } from './component-config.model';
import { ComponentCategory } from './component-category.enum';
import { notComponentConfig } from './component-types/not/not.config';
import { andComponentConfig } from './component-types/and/and.config';
import { romComponentConfig } from './component-types/rom/rom.config';
import { textComponentConfig } from './component-types/text/text.config';
import { inputComponentConfig } from './component-types/input/input.config';
import { outputComponentConfig } from './component-types/output/output.config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BUILT_IN_COMPONENTS: ComponentConfig<any>[] = [
	notComponentConfig,
	andComponentConfig,
	romComponentConfig,
	textComponentConfig,
	inputComponentConfig,
	outputComponentConfig
];

@Injectable({
	providedIn: 'root'
})
export class ComponentProviderService {
	// Keyed by numeric type id (not the closed `ComponentType` enum) so
	// runtime-allocated custom configs can be registered alongside built-ins.
	// A signal so the reactive category lists below update on register/unregister.
	private readonly _configs = signal<ReadonlyMap<number, ComponentConfig>>(
		new Map(BUILT_IN_COMPONENTS.map((config) => [config.type, config]))
	);

	public readonly basicComponents = this._categorySignal(
		ComponentCategory.BASIC
	);
	public readonly advancedComponents = this._categorySignal(
		ComponentCategory.ADVANCED
	);
	public readonly userComponents = this._categorySignal(ComponentCategory.USER);
	public readonly ioComponents = this._categorySignal(ComponentCategory.IO);

	public getComponent(type: number): ComponentConfig | undefined {
		return this._configs().get(type);
	}

	public register(config: ComponentConfig): void {
		this._configs.update((configs) =>
			new Map(configs).set(config.type, config)
		);
	}

	public unregister(typeId: number): void {
		this._configs.update((configs) => {
			if (!configs.has(typeId)) return configs;
			const next = new Map(configs);
			next.delete(typeId);
			return next;
		});
	}

	private _categorySignal(
		category: ComponentCategory
	): Signal<ComponentConfig[]> {
		return computed(() =>
			[...this._configs().values()].filter(
				(config) => config.category === category
			)
		);
	}
}
