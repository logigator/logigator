import { Injectable } from '@angular/core';
import { ComponentConfig } from './component-config.model';
import { ComponentType } from './component-type.enum';
import { ComponentCategory } from './component-category.enum';
import { notComponentConfig } from './component-types/not/not.config';
import { andComponentConfig } from './component-types/and/and.config';
import { romComponentConfig } from './component-types/rom/rom.config';

const COMPONENTS: Record<ComponentType, ComponentConfig> = {
	[ComponentType.NOT]: notComponentConfig,
	[ComponentType.AND]: andComponentConfig,
	[ComponentType.ROM]: romComponentConfig
};

@Injectable({
	providedIn: 'root'
})
export class ComponentProviderService {
	private readonly _componentsByCategory: Map<
		ComponentCategory,
		ComponentConfig[]
	> = new Map();

	constructor() {
		for (const config of Object.values(COMPONENTS)) {
			const category = this._componentsByCategory.get(config.category);
			if (category) {
				category.push(config);
			} else {
				this._componentsByCategory.set(config.category, [config]);
			}
		}
	}

	public getComponent(type: ComponentType): ComponentConfig {
		return COMPONENTS[type];
	}

	public get basicComponents(): ComponentConfig[] {
		return this._componentsByCategory.get(ComponentCategory.BASIC) ?? [];
	}

	public get advancedComponents(): ComponentConfig[] {
		return this._componentsByCategory.get(ComponentCategory.ADVANCED) ?? [];
	}
}
