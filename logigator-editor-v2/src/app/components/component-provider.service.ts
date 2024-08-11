import { Injectable } from '@angular/core';
import { ComponentDef } from './component-def.model';
import { ComponentType } from './component-type.enum';
import { notComponentDef } from './definitions/not.comp';
import { ComponentCategory } from './component-category.enum';
import { andComponentDef } from './definitions/and.comp';

const COMPONENTS: Record<ComponentType, ComponentDef> = {
	[ComponentType.NOT]: notComponentDef,
	[ComponentType.AND]: andComponentDef
};

@Injectable({
	providedIn: 'root'
})
export class ComponentProviderService {
	private readonly _componentsByCategory: Map<
		ComponentCategory,
		ComponentDef[]
	> = new Map();

	constructor() {
		for (const def of Object.values(COMPONENTS)) {
			const category = this._componentsByCategory.get(def.category);
			if (category) {
				category.push(def);
			} else {
				this._componentsByCategory.set(def.category, [def]);
			}
		}
	}

	public getComponent(type: ComponentType): ComponentDef {
		return COMPONENTS[type];
	}

	public get basicComponents(): ComponentDef[] {
		return this._componentsByCategory.get(ComponentCategory.BASIC) ?? [];
	}

	public get advancedComponents(): ComponentDef[] {
		return this._componentsByCategory.get(ComponentCategory.ADVANCED) ?? [];
	}
}
