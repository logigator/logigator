import * as PIXI from "pixi.js";
import {getStaticDI} from '../../../models/get-di';
import {ElementProviderService} from '../../element-provider/element-provider.service';
import {Element} from '../../../models/element';
import {Elements} from '../../../models/elements';
import {ElementTypeId} from '../../../models/element-types/element-type-ids';
import {RenderQuality} from '../svg-image-exporter';
import {ElementType} from '../../../models/element-types/element-type';

export class DefaultRenderer {

	private readonly elementProvider = getStaticDI(ElementProviderService);
	protected readonly SVG_NS = 'http://www.w3.org/2000/svg';

	private _elementType: ElementType;
	private _size: PIXI.Point;
	private _labels: string[];
	private _group: SVGGElement;
	private element: Element;
	private _gridSize: number;

	render(element: Element, gridSize: number, quality: RenderQuality): SVGGElement {
		this.element = element;
		this._gridSize = gridSize;

		this._elementType = this.elementProvider.getElementById(element.typeId);
		if (this._elementType.calcLabels) this._labels = this._elementType.calcLabels(this.element);

		this._group = document.createElementNS(this.SVG_NS, 'g');

		this._size = Elements.calcElemSize(this.element);
		this._size.x *= gridSize;
		this._size.y *= gridSize;

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
		return this._group;
	}

	private rotation0(inputs: number, outputs: number) {
		let rect: SVGElement;
		if (this.shouldRenderAsRect()) {
			rect = this.renderRect();
		} else {
			rect = document.createElementNS(this.SVG_NS, 'path');
			rect.setAttribute('d', `M 0,0 h ${this._size.x - this._gridSize * 0.1875} L ${this._size.x},${this._gridSize * 0.1875} v ${this._size.y - this._gridSize * 0.375} L ${this._size.x - this._gridSize * 0.1875},${this._size.y}, h -${this._size.x - this._gridSize * 0.1875}, v -${this._size.y}`);
		}
		rect.setAttribute('class', 'w');
		this._group.appendChild(rect);
		const path = document.createElementNS(this.SVG_NS, 'path');
		let d = '';
		for (let i = 0; i < inputs; i++) {
			d += `M ${-(this._gridSize / 2)},${(this._gridSize / 2) + this._gridSize * i} `;
			d += `h ${this._gridSize / 2} `;
			if (!this._labels || !this._labels[i]) continue;
			const label = this.getLabelText(this._labels[i], 2, (this._gridSize / 2) + this._gridSize * i + 2);
			label.setAttribute('class', 'l-l');
			this._group.appendChild(label);
		}
		for (let i = 0; i < outputs; i++) {
			d += `M ${this._size.x},${(this._gridSize / 2) + this._gridSize * i} `;
			d += `h ${this._gridSize / 2} `;
			if (!this._labels || !this._labels[inputs + i]) continue;
			const label = this.getLabelText(
				this._labels[inputs + i], this._size.x - 2, (this._gridSize / 2) + this._gridSize * i + 2
			);
			label.setAttribute('class', 'l-r');
			this._group.appendChild(label);
		}
		path.setAttribute('d', d);
		path.setAttribute('class', 'w');
		this._group.appendChild(path);
	}

	private rotation1(inputs: number, outputs: number) {
		let rect: SVGElement;
		if (this.shouldRenderAsRect()) {
			rect = this.renderRect();
		} else {
			rect = document.createElementNS(this.SVG_NS, 'path');
			rect.setAttribute('d',
				`M 0,0
			h ${this._size.x}
			v ${this._size.y - 3},
			L ${this._size.x - 3},${this._size.y}
			h -${this._size.x - 6},
			L 0,${this._size.y - 3},
			v -${this._size.y - 3}`
			);
		}
		rect.setAttribute('class', 'w');
		this._group.appendChild(rect);
		const path = document.createElementNS(this.SVG_NS, 'path');
		let d = '';
		for (let i = 0; i < inputs; i++) {
			d += `M ${this._size.x - this._gridSize / 2 - this._gridSize * i},0 `;
			d += `v ${-this._gridSize / 2} `;
			if (!this._labels || !this._labels[i]) continue;
			const label = this.getLabelText(this._labels[i], this._size.x - this._gridSize / 2 - this._gridSize * i, 6);
			label.setAttribute('class', 'l-t');
			this._group.appendChild(label);
		}
		for (let i = 0; i < outputs; i++) {
			d += `M ${this._size.x - this._gridSize / 2 - this._gridSize * i},${this._size.y} `;
			d += `v ${this._gridSize / 2} `;
			if (!this._labels || !this._labels[inputs + i]) continue;
			const label = this.getLabelText(
				this._labels[inputs + i], this._size.x - this._gridSize / 2 - this._gridSize * i, this._size.y - 3
			);
			label.setAttribute('class', 'l-b');
			this._group.appendChild(label);
		}
		path.setAttribute('d', d);
		path.setAttribute('class', 'w');
		this._group.appendChild(path);
	}

	private rotation2(inputs: number, outputs: number) {
		let rect: SVGElement;
		if (this.shouldRenderAsRect()) {
			rect = this.renderRect();
		} else {
			rect = document.createElementNS(this.SVG_NS, 'path');
			rect.setAttribute('d',
				`M 3,0
			h ${this._size.x - 3}
			v ${this._size.y},
			h -${this._size.x - 3}
			L 0,${this._size.y - 3},
			v -${this._size.y - 6}
			L 3,0`
			);
		}
		rect.setAttribute('class', 'w');
		this._group.appendChild(rect);
		const path = document.createElementNS(this.SVG_NS, 'path');
		let d = '';
		for (let i = 0; i < inputs; i++) {
			d += `M ${this._size.x},${this._size.y - (this._gridSize / 2) - this._gridSize * i} `;
			d += `h ${this._gridSize / 2} `;
			if (!this._labels || !this._labels[i]) continue;
			const label = this.getLabelText(
				this._labels[i], this._size.x, this._size.y - (this._gridSize / 2) - this._gridSize * i + 2
			);
			label.setAttribute('class', 'l-r');
			this._group.appendChild(label);
		}
		for (let i = 0; i < outputs; i++) {
			d += `M 0,${this._size.y - (this._gridSize / 2) - (this._gridSize * i)} `;
			d += `h ${-this._gridSize / 2} `;
			if (!this._labels || !this._labels[inputs + i]) continue;
			const label = this.getLabelText(
				this._labels[inputs + i], 2, this._size.y - (this._gridSize / 2) - this._gridSize * i + 2
			);
			label.setAttribute('class', 'l-l');
			this._group.appendChild(label);
		}
		path.setAttribute('d', d);
		path.setAttribute('class', 'w');
		this._group.appendChild(path);
	}

	private rotation3(inputs: number, outputs: number) {
		let rect: SVGElement;
		if (this.shouldRenderAsRect()) {
			rect = this.renderRect();
		} else {
			rect = document.createElementNS(this.SVG_NS, 'path');
			rect.setAttribute('d',
				`M 3,0
			h ${this._size.x - 6}
			L ${this._size.x},3
			v ${this._size.y - 3}
			h -${this._size.x},
			v -${this._size.y - 3},
			L 3,0`
			);
		}
		rect.setAttribute('class', 'w');
		this._group.appendChild(rect);
		const path = document.createElementNS(this.SVG_NS, 'path');
		let d = '';
		for (let i = 0; i < inputs; i++) {
			d += `M ${this._gridSize / 2 + this._gridSize * i},${this._size.y} `;
			d += `v ${this._gridSize / 2} `;
			if (!this._labels || !this._labels[i]) continue;
			const label = this.getLabelText(
				this._labels[i], this._gridSize / 2 + this._gridSize * i, this._size.y - 3
			);
			label.setAttribute('class', 'l-b');
			this._group.appendChild(label);
		}
		for (let i = 0; i < outputs; i++) {
			d += `M ${this._gridSize / 2 + this._gridSize * i},0 `;
			d += `v ${-this._gridSize / 2} `;
			if (!this._labels || !this._labels[inputs + i]) continue;
			const label = this.getLabelText(
				this._labels[inputs + i], this._gridSize / 2 + this._gridSize * i, 6
			);
			label.setAttribute('class', 'l-t');
			this._group.appendChild(label);
		}
		path.setAttribute('d', d);
		path.setAttribute('class', 'w');
		this._group.appendChild(path);
	}

	private symbol() {
		let symbol: SVGElement;
		if (this.elementProvider.isPlugElement(this.element.typeId)) {
			symbol = document.createElementNS(this.SVG_NS, 'text');
			symbol.textContent = this.element.data as string || this.elementProvider.getElementById(this.element.typeId).symbol;
			symbol.setAttribute('class', 'symbol');
			symbol.setAttribute('x', this._size.x / 2 + '');
			symbol.setAttribute('y', this._size.y / 2 + 3 + '');
		} else if (this.element.typeId === ElementTypeId.BUTTON) {
			symbol = document.createElementNS(this.SVG_NS, 'rect');
			symbol.setAttribute('class', 'w');
			symbol.setAttribute('x', '3');
			symbol.setAttribute('y', '3');
			symbol.setAttribute('width', this._gridSize - 6 + '');
			symbol.setAttribute('height', this._gridSize - 6 + '');
		} else if (this.element.typeId === ElementTypeId.LEVER) {
			symbol = document.createElementNS(this.SVG_NS, 'line');
			symbol.setAttribute('class', 'w');
			symbol.setAttribute('x1', '0');
			symbol.setAttribute('y1', this._gridSize - 4 + '');
			symbol.setAttribute('x1', this._size.x + '');
			symbol.setAttribute('y2', this._gridSize - 4 + '');
		} else if (this.element.typeId === ElementTypeId.LED_MATRIX) {
			symbol = document.createElementNS(this.SVG_NS, 'g');
			const ledAmount = this.element.options[0];
			const ledSize = (this._size.x - this._gridSize * 2) / ledAmount - 1;
			let offsetX = this._gridSize;
			let offsetY = this._gridSize;
			switch (this.element.rotation) {
				case 0:
					offsetX = 1.5 * this._gridSize;
					break;
				case 1:
					offsetY = 1.5 * this._gridSize;
					break;
				case 2:
					offsetX = 0.5 * this._gridSize;
					break;
				case 3:
					offsetY = 0.5 * this._gridSize;
					break;
			}
			for (let x = 0; x < ledAmount; x++) {
				for (let y = 0; y < ledAmount; y++) {
					const led = document.createElementNS(this.SVG_NS, 'rect');
					led.setAttribute('class', 'led');
					led.setAttribute('x', (offsetX + x * ledSize + x) + '');
					led.setAttribute('y', (offsetY + y * ledSize + y) + '');
					led.setAttribute('width', ledSize + '');
					led.setAttribute('height', ledSize + '');
					symbol.appendChild(led);
				}
			}
		} else {
			symbol = document.createElementNS(this.SVG_NS, 'text');
			symbol.textContent = this._elementType.symbol;
			symbol.setAttribute('class', 'symbol');
			symbol.setAttribute('x', this._size.x / 2 + '');
			symbol.setAttribute('y', this._size.y / 2 + 3 + '');
		}
		if (symbol) this._group.appendChild(symbol);
	}

	private getLabelText(text: string, x: number, y: number): SVGTextElement {
		const label = document.createElementNS(this.SVG_NS, 'text');
		label.textContent = text;
		label.setAttribute('x', x + '');
		label.setAttribute('y', y + '');
		return label;
	}

	private renderRect() {
		const rect = document.createElementNS(this.SVG_NS, 'rect');
		rect.setAttribute('x', '0');
		rect.setAttribute('y', '0');
		rect.setAttribute('width', this._size.x + '');
		rect.setAttribute('height', this._size.y + '');
		return rect;
	}

	private shouldRenderAsRect(): boolean {
		return this.element.typeId === ElementTypeId.INPUT ||
			this.element.typeId === ElementTypeId.OUTPUT ||
			this.element.typeId === ElementTypeId.BUTTON ||
			this.element.typeId === ElementTypeId.LEVER ||
			this.element.typeId === ElementTypeId.SEGMENT_DISPLAY ||
			this.element.typeId === ElementTypeId.LED_MATRIX;
	}
}
