// @ts-strict-ignore
import { BaseRenderer } from './base-renderer';
import { RenderQuality } from '../svg-image-exporter';
import { TextData } from '../../../models/element-types/basic/text';

export class TextRenderer extends BaseRenderer {
	render(): SVGGElement {
		if (this.quality >= RenderQuality.high) {
			const point = document.createElementNS(this.SVG_NS, 'rect');
			point.setAttribute(
				'x',
				this.gridSize / 2 - (this.gridSize < 8 ? 2.5 : 3.5) + ''
			);
			point.setAttribute(
				'y',
				this.gridSize / 2 - (this.gridSize < 8 ? 2.5 : 3.5) + ''
			);
			point.setAttribute('width', this.gridSize < 8 ? '5' : '7');
			point.setAttribute('height', this.gridSize < 8 ? '5' : '7');
			point.setAttribute('class', 'cp');
			this._group.appendChild(point);
		}

		const textParts = (this.element.data as TextData).split('\n');
		for (let i = 0; i < textParts.length; i++) {
			const text = document.createElementNS(this.SVG_NS, 'text');
			text.textContent = textParts[i];
			text.setAttribute('class', 'text');
			text.setAttribute(
				'style',
				`font-size:${(this.element.options[0] / 9.5) * this.gridSize}px;`
			);
			text.setAttribute('x', this.gridSize + '');
			text.setAttribute(
				'y',
				this.gridSize / 2 +
					this.scaled(this.element.options[0] / 2) +
					i * this.scaled(this.element.options[0] * 2) +
					''
			);
			this._group.appendChild(text);
		}

		return this._group;
	}
}
