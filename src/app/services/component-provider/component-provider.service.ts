import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class ComponentProviderService {

	private basicComponents = {
		0: 'Wire',
		1: '1',
		2: '&',
		3: '≥1',
		4: '=1'
	};

	private allComponents;

	constructor() { }

	public getComponentNameById(id: number): string {
		if (this.basicComponents.hasOwnProperty(id)) {
			return this.basicComponents[id];
		}
		return '';
	}

	public getAllComponents(): {id: number, name: string}[] {
		if (this.allComponents) {
			return this.allComponents;
		}
		const allComponents = [];
		Object.keys(this.basicComponents).forEach(comp => {
			allComponents.push({
				id: Number(comp),
				name: this.basicComponents[comp]
			});
		});
		this.allComponents = allComponents.filter(comp => comp.id !== 0);
		return this.allComponents;
		// TODO get user created components from server and cache them
	}
}
