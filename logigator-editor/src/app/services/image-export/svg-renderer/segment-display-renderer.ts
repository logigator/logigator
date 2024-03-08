// @ts-strict-ignore
import { BaseRenderer } from './base-renderer';
import { RenderQuality } from '../svg-image-exporter';
import { ElementRotation } from '../../../models/element';

export class SegmentDisplayRenderer extends BaseRenderer {
	render(): SVGGElement {
		let path = `M 0,0 h ${this.size.x} v ${this.size.y} H 0 V 0`;

		// wire ends
		if (this._quality >= RenderQuality.high) {
			switch (this.element.rotation) {
				case ElementRotation.Right:
					for (let i = 0; i < this._element.numInputs; i++) {
						path += ` M ${-(this._gridSize / 2)},${
							this._gridSize / 2 + this._gridSize * i
						} h ${this._gridSize / 2}`;
					}
					break;
				case ElementRotation.Down:
					for (let i = 0; i < this._element.numInputs; i++) {
						path += ` M ${
							this._size.x - this._gridSize / 2 - this._gridSize * i
						},0 v ${-this._gridSize / 2}`;
					}
					break;
				case ElementRotation.Left:
					for (let i = 0; i < this._element.numInputs; i++) {
						path += ` M ${this._size.x},${
							this._size.y - this._gridSize / 2 - this._gridSize * i
						} h ${this._gridSize / 2}`;
					}
					break;
				case ElementRotation.Up:
					for (let i = 0; i < this._element.numInputs; i++) {
						path += ` M ${this._gridSize / 2 + this._gridSize * i},${
							this._size.y
						} v ${this._gridSize / 2}`;
					}
					break;
			}
		}

		const element = document.createElementNS(this.SVG_NS, 'path');
		element.setAttribute('class', 'c');
		element.setAttribute('d', path);
		this._group.appendChild(element);

		// Labels
		if (this._quality >= RenderQuality.full) {
			switch (this._element.rotation) {
				case ElementRotation.Right:
					for (let i = 0; i < this._element.numInputs; i++) {
						const label = this.getLabelText(
							this._labels[i],
							2,
							this._gridSize / 2 + this._gridSize * i + this.scaled(2)
						);
						label.setAttribute('class', 'l-l');
						this._group.appendChild(label);
					}
					break;
				case ElementRotation.Down:
					for (let i = 0; i < this._element.numInputs; i++) {
						const label = this.getLabelText(
							this._labels[i],
							this._size.x - this._gridSize / 2 - this._gridSize * i,
							this.scaled(6)
						);
						label.setAttribute('class', 'l-t');
						this._group.appendChild(label);
					}
					break;
				case ElementRotation.Left:
					for (let i = 0; i < this._element.numInputs; i++) {
						const label = this.getLabelText(
							this._labels[i],
							this._size.x,
							this._size.y -
								this._gridSize / 2 -
								this._gridSize * i +
								this.scaled(2)
						);
						label.setAttribute('class', 'l-r');
						this._group.appendChild(label);
					}
					break;
				case ElementRotation.Up:
					for (let i = 0; i < this._element.numInputs; i++) {
						const label = this.getLabelText(
							this._labels[i],
							this._gridSize / 2 + this._gridSize * i,
							this._size.y - this.scaled(3)
						);
						label.setAttribute('class', 'l-b');
						this._group.appendChild(label);
					}
					break;
			}
		}

		let str = '0';
		let strLength;
		switch (this.element.options[0]) {
			case 1:
				strLength = Math.ceil(this.element.numInputs / 4);
				break;
			case 2:
				strLength = Math.ceil(this.element.numInputs / 3);
				break;
			default:
				strLength = Math.ceil(Math.log10(2 ** this.element.numInputs + 1));
		}
		while (str.length < strLength) str = '0' + str;
		const segments = this.getLabelText(
			str,
			this.size.x / 2,
			this.size.y / 2 + this.gridSize * 0.675
		);
		segments.setAttribute(
			'class',
			this.element.options[0] === 1 ? 'seg14' : 'seg7'
		);
		this._group.appendChild(segments);

		if (this.quality >= RenderQuality.high) {
			const base = this.getLabelText(
				this.element.options[0] === 0
					? '10'
					: this.element.options[0] === 1
						? '16'
						: '8',
				this.size.x / 2 +
					this.gridSize * 0.43 +
					this.gridSize * 0.56 * (strLength - 1) -
					(this.element.options[0] !== 2 ? this.gridSize * 0.2 : 0),
				this.size.y / 2 + this.gridSize * 0.675 + this.gridSize * 0.2
			);
			base.setAttribute('class', 'sb');
			this._group.appendChild(base);
		}
		return this._group;
	}
}
