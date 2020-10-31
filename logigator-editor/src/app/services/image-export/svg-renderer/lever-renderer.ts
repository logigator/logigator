import {BaseRenderer} from './base-renderer';
import {RenderQuality} from '../svg-image-exporter';
import {ElementRotation} from '../../../models/element';

export class LeverRenderer extends BaseRenderer {
	render(): SVGGElement {
		let path = `M 0,0 h ${this.gridSize} v ${this.gridSize} H 0 V 0 M 0,${this.gridSize - this.scaled(4)} H ${this.gridSize}`;
		if (this.quality >= RenderQuality.high) {
			switch (this.element.rotation) {
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
		return this._group;
	}
}
