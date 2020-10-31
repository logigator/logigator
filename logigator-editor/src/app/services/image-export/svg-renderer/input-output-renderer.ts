import {BaseRenderer} from './base-renderer';
import {RenderQuality} from '../svg-image-exporter';
import {ElementRotation} from '../../../models/element';
import {ElementTypeId} from '../../../models/element-types/element-type-ids';

export class InputOutputRenderer extends BaseRenderer {
	render(): SVGGElement {
		let path = ` M 0,0 h ${this.gridSize} v ${this.gridSize} H 0 V 0`;
		if (this.quality >= RenderQuality.high) {
			let rotation = this.element.rotation;
			if (this.element.typeId === ElementTypeId.OUTPUT)
				rotation = (rotation + 2) % 4;
			switch (rotation) {
				case ElementRotation.right:
					path += ` M ${this.gridSize},${this.gridSize / 2} h ${this.gridSize / 2}`;
					break;
				case ElementRotation.down:
					path += ` M ${this.gridSize / 2},${this.gridSize} v ${this.gridSize / 2}`;
					break;
				case ElementRotation.left:
					path += ` M 0,${this.gridSize / 2} h ${-this.gridSize / 2}`;
					break;
				case ElementRotation.up:
					path += ` M ${this.gridSize / 2},0 v ${-this.gridSize / 2}`;
					break;
			}
		}
		const element = document.createElementNS(this.SVG_NS, 'path');
		element.setAttribute('d', path);
		element.setAttribute('class', 'c');
		this._group.appendChild(element);

		if (this.quality >= RenderQuality.high) {
			const symbol = document.createElementNS(this.SVG_NS, 'text');
			symbol.textContent = this._elementType.symbol;
			symbol.setAttribute('class', 's');
			symbol.setAttribute('x', this._size.x / 2 + '');
			symbol.setAttribute('y', this._size.y / 2 + this.scaled(3) + '');
			this._group.appendChild(symbol);
		}

		return this._group;
	}
}
