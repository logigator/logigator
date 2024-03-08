import { BaseRenderer } from './base-renderer';
import { ElementRotation } from '../../../models/element';
import { RenderQuality } from '../svg-image-exporter';

export class LedRenderer extends BaseRenderer {
	render(): SVGGElement {
		if (this.quality >= RenderQuality.high) {
			const input = document.createElementNS(this.SVG_NS, 'path');
			input.setAttribute('class', 'w');
			switch (this._element.rotation) {
				case ElementRotation.Right:
					input.setAttribute(
						'd',
						`M 0,${this.gridSize / 2} h ${-this.gridSize / 2}`
					);
					break;
				case ElementRotation.Down:
					input.setAttribute(
						'd',
						`M ${this.gridSize / 2},0 v ${-this.gridSize / 2}`
					);
					break;
				case ElementRotation.Left:
					input.setAttribute(
						'd',
						`M ${this.gridSize},${this.gridSize / 2} h ${this.gridSize / 2}`
					);
					break;
				case ElementRotation.Up:
					input.setAttribute(
						'd',
						`M ${this.gridSize / 2},${this.gridSize} v ${this.gridSize / 2}`
					);
					break;
			}
			this.group.appendChild(input);
		}

		const led = document.createElementNS(this.SVG_NS, 'circle');
		led.setAttribute('cx', this.gridSize / 2 + '');
		led.setAttribute('cy', this.gridSize / 2 + '');
		led.setAttribute('r', this.gridSize / 2 + '');
		led.setAttribute('class', 'led');

		this.group.appendChild(led);
		return this._group;
	}
}
