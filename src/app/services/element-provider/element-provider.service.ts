import { Injectable } from '@angular/core';
import {ElementType} from '../../models/element-type';
import {wire} from '../../models/element-types/wire';
import {not} from '../../models/element-types/not';
import {and} from '../../models/element-types/and';
import {or} from '../../models/element-types/or';
import {xor} from '../../models/element-types/xor';
import {HttpClient} from '@angular/common/http';
import {HttpResponseData} from '../../models/http-responses/http-response-data';
import {ComponentInfoResponse} from '../../models/http-responses/component-info-response';

@Injectable({
	providedIn: 'root'
})
export class ElementProviderService {

	public static staticInstance: ElementProviderService;

	private _basicElements: Map<number, ElementType> = new Map([
		[0, wire],
		[1, not],
		[2, and],
		[3, or],
		[4, xor],
	]);

	private _ioElements: Map<number, ElementType> = new Map<number, ElementType>();

	private _userDefinedElements: Map<number, ElementType> = new Map<number, ElementType>();

	constructor(private httpClient: HttpClient) {
		ElementProviderService.staticInstance = this;

		this.httpClient.get<HttpResponseData<ComponentInfoResponse[]>>('/api/project/get-all-components-info').subscribe(data => {
			data.result.forEach(elem => {
				const elemType: ElementType = {
					description: elem.description,
					name: elem.name,
					rotation: 0,
					hasVariableInputs: false,
					symbol: elem.symbol,
					numInputs: 2,
					numOutputs: 1,
					category: 'user'
				};
				this._userDefinedElements.set(elem.pk_id, elemType);
			});
		});
	}

	public getElementById(id: number): ElementType {
		if (this._basicElements.has(id)) {
			return this._basicElements.get(id);
		} else if (this._ioElements.has(id)) {
			return this._ioElements.get(id);
		}
		return this._userDefinedElements.get(id);
	}

	public get basicElements(): Map<number, ElementType> {
		return this._basicElements;
	}

	public get ioElements(): Map<number, ElementType> {
		return this._ioElements;
	}

	public get userDefinedElements(): Map<number, ElementType> {
		return this._userDefinedElements;
	}

}
