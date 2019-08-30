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

	constructor() { }

	public getComponentNameById(id: number): string {
		if (this.basicComponents.hasOwnProperty(id)) {
			return this.basicComponents[id];
		}
		return '';
	}
}
