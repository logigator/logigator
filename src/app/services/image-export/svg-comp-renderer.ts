import {Element} from '../../models/element';
import {ElementType} from '../../models/element-types/element-type';
import {getStaticDI} from '../../models/get-di';
import {ElementProviderService} from '../element-provider/element-provider.service';
import {environment} from '../../../environments/environment';
import {Grid} from '../../models/rendering/grid';
import {ElementTypeId} from '../../models/element-types/element-type-ids';
import * as PIXI from 'pixi.js';

export class SvgCompRenderer {

	private readonly SVG_NS = 'http://www.w3.org/2000/svg';

	private readonly _elementType: ElementType;

	private readonly _width: number;
	private readonly _height: number;

	private readonly _labels: string[];

	private readonly _group: SVGGElement;

	private readonly elementProvider = getStaticDI(ElementProviderService);

	constructor(private element: Element, private offset: PIXI.Point) {
		this._elementType = this.elementProvider.getElementById(element.typeId);
		if (this._elementType.calcLabels) this._labels = this._elementType.calcLabels(this.element);

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
		this.symbol();

		const pos = Grid.getPixelPosForGridPos(new PIXI.Point(element.pos.x - this.offset.x, element.pos.y - this.offset.y));
		this._group.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
	}

	private rotation0(inputs: number, outputs: number) {
		const rect = document.createElementNS(this.SVG_NS, 'path');
		rect.setAttribute('d',
			`M 0,0
			h ${this._width - 3}
			L ${this._width},3
			v ${this._height - 6}
			L ${this._width - 3},${this._height},
			h -${this._width - 3},
			v -${this._height}`
		);
		rect.setAttribute('class', 'wire');
		this._group.appendChild(rect);
		const path = document.createElementNS(this.SVG_NS, 'path');
		let d = '';
		for (let i = 0; i < inputs; i++) {
			d += `M ${-(environment.gridPixelWidth / 2)},${(environment.gridPixelWidth / 2) + environment.gridPixelWidth * i} `;
			d += `h ${environment.gridPixelWidth / 2} `;
			if (!this._labels || !this._labels[i]) continue;
			const label = this.getLabelText(this._labels[i], 2, (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i);
			label.setAttribute('class', 'l-l');
			this._group.appendChild(label);
		}
		for (let i = 0; i < outputs; i++) {
			d += `M ${this._width},${(environment.gridPixelWidth / 2) + environment.gridPixelWidth * i} `;
			d += `h ${environment.gridPixelWidth / 2} `;
			if (!this._labels || !this._labels[inputs + i]) continue;
			const label = this.getLabelText(
				this._labels[inputs + i], this._width - 2, (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i
			);
			label.setAttribute('class', 'l-r');
			this._group.appendChild(label);
		}
		path.setAttribute('d', d);
		path.setAttribute('class', 'wire');
		this._group.appendChild(path);
	}

	private rotation1(inputs: number, outputs: number) {
		const rect = document.createElementNS(this.SVG_NS, 'path');
		rect.setAttribute('d',
			`M 0,0
			h ${this._width}
			v ${this._height - 3},
			L ${this._width - 3},${this._height}
			h -${this._width - 6},
			L 0,${this._height - 3},
			v -${this._height - 3}`
		);
		rect.setAttribute('class', 'wire');
		this._group.appendChild(rect);
		const path = document.createElementNS(this.SVG_NS, 'path');
		let d = '';
		for (let i = 0; i < inputs; i++) {
			d += `M ${this._width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i},0 `;
			d += `v ${-environment.gridPixelWidth / 2} `;
			if (!this._labels || !this._labels[i]) continue;
			const label = this.getLabelText(this._labels[i], this._width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i, 2);
			label.setAttribute('class', 'l-t');
			this._group.appendChild(label);
		}
		for (let i = 0; i < outputs; i++) {
			d += `M ${this._width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i},${this._height} `;
			d += `v ${environment.gridPixelWidth / 2} `;
			if (!this._labels || !this._labels[inputs + i]) continue;
			const label = this.getLabelText(
				this._labels[inputs + i], this._width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i, this._height - 2
			);
			label.setAttribute('class', 'l-b');
			this._group.appendChild(label);
		}
		path.setAttribute('d', d);
		path.setAttribute('class', 'wire');
		this._group.appendChild(path);
	}

	private rotation2(inputs: number, outputs: number) {
		const rect = document.createElementNS(this.SVG_NS, 'path');
		rect.setAttribute('d',
			`M 3,0
			h ${this._width - 3}
			v ${this._height},
			h -${this._width - 3}
			L 0,${this._height - 3},
			v -${this._height - 6}
			L 3,0`
		);
		rect.setAttribute('class', 'wire');
		this._group.appendChild(rect);
		const path = document.createElementNS(this.SVG_NS, 'path');
		let d = '';
		for (let i = 0; i < inputs; i++) {
			d += `M ${this._width},${this._height - (environment.gridPixelWidth / 2) - environment.gridPixelWidth * i} `;
			d += `h ${environment.gridPixelWidth / 2} `;
			if (!this._labels || !this._labels[i]) continue;
			const label = this.getLabelText(
				this._labels[i], this._width - 2, this._height - (environment.gridPixelWidth / 2) - environment.gridPixelWidth * i
			);
			label.setAttribute('class', 'l-r');
			this._group.appendChild(label);
		}
		for (let i = 0; i < outputs; i++) {
			d += `M 0,${this._height - (environment.gridPixelWidth / 2) - (environment.gridPixelWidth * i)} `;
			d += `h ${-environment.gridPixelWidth / 2} `;
			if (!this._labels || !this._labels[inputs + i]) continue;
			const label = this.getLabelText(
				this._labels[inputs + i], 2, this._height - (environment.gridPixelWidth / 2) - environment.gridPixelWidth * i
			);
			label.setAttribute('class', 'l-l');
			this._group.appendChild(label);
		}
		path.setAttribute('d', d);
		path.setAttribute('class', 'wire');
		this._group.appendChild(path);
	}

	private rotation3(inputs: number, outputs: number) {
		const rect = document.createElementNS(this.SVG_NS, 'path');
		rect.setAttribute('d',
			`M 3,0
			h ${this._width - 6}
			L ${this._width},3
			v ${this._height - 3}
			h -${this._width},
			v -${this._height - 3},
			L 3,0`
		);
		rect.setAttribute('class', 'wire');
		this._group.appendChild(rect);
		const path = document.createElementNS(this.SVG_NS, 'path');
		let d = '';
		for (let i = 0; i < inputs; i++) {
			d += `M ${(environment.gridPixelWidth / 2) + environment.gridPixelWidth * i},${this._height} `;
			d += `v ${environment.gridPixelWidth / 2} `;
			if (!this._labels || !this._labels[i]) continue;
			const label = this.getLabelText(
				this._labels[i], this._width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i, this._height - 2
			);
			label.setAttribute('class', 'l-b');
			this._group.appendChild(label);
		}
		for (let i = 0; i < outputs; i++) {
			d += `M ${environment.gridPixelWidth / 2 + environment.gridPixelWidth * i},0 `;
			d += `v ${-environment.gridPixelWidth / 2} `;
			if (!this._labels || !this._labels[inputs + i]) continue;
			const label = this.getLabelText(
				this._labels[inputs + i], this._width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i, 2
			);
			label.setAttribute('class', 'l-t');
			this._group.appendChild(label);
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
			symbol.setAttribute('x', this._width / 2 + '');
			symbol.setAttribute('y', this._height / 2 + '');
		}
		this._group.appendChild(symbol);
	}

	private getLabelText(text: string, x: number, y: number): SVGTextElement {
		const label = document.createElementNS(this.SVG_NS, 'text');
		label.textContent = text;
		label.setAttribute('x', x + '');
		label.setAttribute('y', y + '');
		return label;
	}

	public getSVGGroup(): SVGGElement {
		return this._group;
	}
}
