import {Element} from '../../models/element';
import {ElementType} from '../../models/element-types/element-type';
import {getStaticDI} from '../../models/get-di';
import {ElementProviderService} from '../element-provider/element-provider.service';
import {environment} from '../../../environments/environment';
import {Grid} from '../../models/rendering/grid';
import {ElementTypeId} from '../../models/element-types/element-type-ids';

export class SvgCompRenderer {

	private readonly SVG_NS = 'http://www.w3.org/2000/svg';

	private readonly _elementType: ElementType;

	private readonly _width: number;
	private readonly _height: number;

	private readonly _group: SVGGElement;

	private readonly elementProvider = getStaticDI(ElementProviderService);

	constructor(private element: Element) {
		this._elementType = this.elementProvider.getElementById(element.typeId);

		this._group = document.createElementNS(this.SVG_NS, 'g');

		if (element.rotation === 0 || element.rotation === 2) {
			this._width = environment.gridPixelWidth * this._elementType.width;
			this._height = element.numInputs >= element.numOutputs ?
				environment.gridPixelWidth * element.numInputs :
				environment.gridPixelWidth * element.numOutputs;
		} else {
			this._width = element.numInputs >= element.numOutputs ?
				environment.gridPixelWidth * element.numInputs :
				environment.gridPixelWidth * element.numOutputs;
			this._height = environment.gridPixelWidth * this._elementType.width;
		}

		const rect = document.createElementNS(this.SVG_NS, 'rect');
		rect.setAttribute('x', '0');
		rect.setAttribute('y', '0');
		rect.setAttribute('width', this._width + '');
		rect.setAttribute('height', this._height + '');
		rect.setAttribute('class', 'wire');
		this._group.appendChild(rect);
		this.symbol();

		switch (this.element.rotation) {
			case 0:
				this.rotation0(this.element.numInputs, this.element.numOutputs);
				break;
			case 1:
				this.rotation1(this.element.numInputs, this.element.numOutputs);
				break;
			case 2:
				this.rotation2(this.element.numInputs, this.element.numOutputs);
				break;
			case 3:
				this.rotation3(this.element.numInputs, this.element.numOutputs);
				break;
		}

		const pos = Grid.getPixelPosForGridPos(element.pos);
		this._group.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
	}

	private rotation0(inputs: number, outputs: number) {
		const path = document.createElementNS(this.SVG_NS, 'path');
		let d = '';
		for (let i = 0; i < inputs; i++) {
			d += `M ${-(environment.gridPixelWidth / 2)},${(environment.gridPixelWidth / 2) + environment.gridPixelWidth * i} `;
			d += `h ${environment.gridPixelWidth / 2} `;
		}
		for (let i = 0; i < outputs; i++) {
			d += `M ${this._width},${(environment.gridPixelWidth / 2) + environment.gridPixelWidth * i} `;
			d += `h ${environment.gridPixelWidth / 2} `;
		}
		path.setAttribute('d', d);
		path.setAttribute('class', 'wire');
		this._group.appendChild(path);
	}

	private rotation1(inputs: number, outputs: number) {
		const path = document.createElementNS(this.SVG_NS, 'path');
		let d = '';
		for (let i = 0; i < inputs; i++) {
			d += `M ${this._width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i},0 `;
			d += `v ${-environment.gridPixelWidth / 2} `;
		}
		for (let i = 0; i < outputs; i++) {
			d += `M ${this._width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i},${this._height} `;
			d += `v ${environment.gridPixelWidth / 2} `;
		}
		path.setAttribute('d', d);
		path.setAttribute('class', 'wire');
		this._group.appendChild(path);
	}

	private rotation2(inputs: number, outputs: number) {
		const path = document.createElementNS(this.SVG_NS, 'path');
		let d = '';
		for (let i = 0; i < inputs; i++) {
			d += `M ${this._width},${this._height - (environment.gridPixelWidth / 2) - environment.gridPixelWidth * i} `;
			d += `h ${environment.gridPixelWidth / 2} `;
		}
		for (let i = 0; i < outputs; i++) {
			d += `M 0,${this._height - (environment.gridPixelWidth / 2) - (environment.gridPixelWidth * i)} `;
			d += `h ${-environment.gridPixelWidth / 2} `;
		}
		path.setAttribute('d', d);
		path.setAttribute('class', 'wire');
		this._group.appendChild(path);
	}

	private rotation3(inputs: number, outputs: number) {
		const path = document.createElementNS(this.SVG_NS, 'path');
		let d = '';
		for (let i = 0; i < inputs; i++) {
			d += `M ${(environment.gridPixelWidth / 2) + environment.gridPixelWidth * i},${this._height} `;
			d += `v ${environment.gridPixelWidth / 2} `;
		}
		for (let i = 0; i < outputs; i++) {
			d += `M ${environment.gridPixelWidth / 2 + environment.gridPixelWidth * i},0 `;
			d += `v ${-environment.gridPixelWidth / 2} `;
		}
		path.setAttribute('d', d);
		path.setAttribute('class', 'wire');
		this._group.appendChild(path);
	}

	private symbol() {
		let symbol: SVGElement;
		if (this.element.typeId === ElementTypeId.BUTTON) {
			symbol = document.createElementNS(this.SVG_NS, 'rect');
			symbol.setAttribute('class', 'wire');
			symbol.setAttribute('x', '3');
			symbol.setAttribute('y', '3');
			symbol.setAttribute('width', environment.gridPixelWidth - 6 + '');
			symbol.setAttribute('height', environment.gridPixelWidth - 6 + '');
		} else if (this.element.typeId === ElementTypeId.LEVER) {
			symbol = document.createElementNS(this.SVG_NS, 'line');
			symbol.setAttribute('class', 'wire');
			symbol.setAttribute('x1', '0');
			symbol.setAttribute('y1', environment.gridPixelWidth - 4 + '');
			symbol.setAttribute('x1', this._width + '');
			symbol.setAttribute('y2', environment.gridPixelWidth - 4 + '');
		} else {
			symbol = document.createElementNS(this.SVG_NS, 'text');
			symbol.textContent = this._elementType.symbol;
			symbol.setAttribute('class', 'symbol');
			symbol.setAttribute('font-size', '15');
			symbol.setAttribute('x', this._width / 2 + '');
			symbol.setAttribute('y', this._height / 2 + '');
		}
		this._group.appendChild(symbol);
	}

	public getSVGGroup(): SVGGElement {
		return this._group;
	}
}
