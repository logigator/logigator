import { Injectable } from '@angular/core';
import {Element, Elements} from '../../models/element';
import {ProjectsService} from '../projects/projects.service';

@Injectable({
	providedIn: 'root'
})
export class CopyService {

	public static staticInstance: CopyService;

	private _copiedElements: Element[] = [];

	constructor() {
		CopyService.staticInstance = this;
	}

	public copyIds(ids: number[]): Element[] {
		return this.copyElements(ProjectsService.staticInstance.currProject.currState.getElementsById(ids));
	}

	public copyElements(elements: Element[]): Element[] {
		this._copiedElements = new Array(elements.length);
		for (let i = 0; i < elements.length; i++) {
			this._copiedElements[i] = Elements.clone(elements[i]);
		}
		return this._copiedElements;
	}

	get copiedElements(): Element[] {
		return this._copiedElements;
	}
}
