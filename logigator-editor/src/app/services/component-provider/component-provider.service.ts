import { Injectable } from '@angular/core';
import { ComponentConfig } from '../../classes/rendering/component';
import { romComponentConfig } from '../../classes/rendering/components/rom.component';
import { ElementCategory } from '../../models/element/element-category';

@Injectable({
	providedIn: 'root'
})
export class ComponentProviderService {
	private readonly _components: ComponentConfig[] = [romComponentConfig];

	get components(): readonly ComponentConfig[] {
		return this._components;
	}

	public getElementsByCategory(category: ElementCategory): ComponentConfig[] {
		return this._components.filter((component) => component.category === category);
	}
}
