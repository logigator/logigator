import {BaseRenderer} from './base-renderer';
import {RenderQuality} from '../svg-image-exporter';
import {ElementRotation} from '../../../models/element';
import {environment} from '../../../../environments/environment';

export class LedMatrixRenderer extends BaseRenderer {
	render(): SVGGElement {
		let path = `M 0,0 h ${this.size.x} v ${this.size.y} H 0 V 0`;

		// wire ends
		if (this._quality >= RenderQuality.high) {
			switch (this.element.rotation) {
				case ElementRotation.right:
					for (let i = 0; i < this._element.numInputs; i++) {
						path += ` M ${-(this._gridSize / 2)},${(this._gridSize / 2) + this._gridSize * i} h ${this._gridSize / 2}`;
					}
					break;
				case ElementRotation.down:
					for (let i = 0; i < this._element.numInputs; i++) {
						path += ` M ${this._size.x - this._gridSize / 2 - this._gridSize * i},0 v ${-this._gridSize / 2}`;
					}
					break;
				case ElementRotation.left:
					for (let i = 0; i < this._element.numInputs; i++) {
						path += ` M ${this._size.x},${this._size.y - (this._gridSize / 2) - this._gridSize * i} h ${this._gridSize / 2}`;
					}
					break;
				case ElementRotation.up:
					for (let i = 0; i < this._element.numInputs; i++) {
						path += ` M ${this._gridSize / 2 + this._gridSize * i},${this._size.y} v ${this._gridSize / 2}`;
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
				case ElementRotation.right:
					for (let i = 0; i < this._element.numInputs; i++) {
						const label = this.getLabelText(this._labels[i], 2, (this._gridSize / 2) + this._gridSize * i + this.scaled(2));
						label.setAttribute('class', 'l-l');
						this._group.appendChild(label);
					}
					break;
				case ElementRotation.down:
					for (let i = 0; i < this._element.numInputs; i++) {
						const label = this.getLabelText(this._labels[i], this._size.x - this._gridSize / 2 - this._gridSize * i, this.scaled(6));
						label.setAttribute('class', 'l-t');
						this._group.appendChild(label);
					}
					break;
				case ElementRotation.left:
					for (let i = 0; i < this._element.numInputs; i++) {
						const label = this.getLabelText(this._labels[i], this._size.x, this._size.y - (this._gridSize / 2) - this._gridSize * i + this.scaled(2));
						label.setAttribute('class', 'l-r');
						this._group.appendChild(label);
					}
					break;
				case ElementRotation.up:
					for (let i = 0; i < this._element.numInputs; i++) {
						const label = this.getLabelText(this._labels[i], this._gridSize / 2 + this._gridSize * i, this._size.y - this.scaled(3));
						label.setAttribute('class', 'l-b');
						this._group.appendChild(label);
					}
					break;
			}
		}

		const ledSize = (this._size.x - this.gridSize * 2) / this.element.options[0] - 1;
		let ledPath = '';
		for (let y = 0; y < this.element.options[0]; y++) {
			for (let x = 0; x < this.element.options[0]; x++) {
				ledPath += `M ${ledSize * x + x},${ledSize * y + y} h ${ledSize} v ${ledSize} h ${-ledSize} v ${-ledSize}`;
			}
		}

		const leds = document.createElementNS(this.SVG_NS, 'path');
		leds.setAttribute('class', 'led');
		leds.setAttribute('d', ledPath);
		switch (this.element.rotation) {
			case ElementRotation.right:
				leds.setAttribute('transform', `translate(${1.5 * this.gridSize}, ${this.gridSize})`);
				break;
			case ElementRotation.down:
				leds.setAttribute('transform', `translate(${this.gridSize}, ${1.5 * this.gridSize})`);
				break;
			case ElementRotation.left:
				leds.setAttribute('transform', `translate(${0.5 * this.gridSize}, ${this.gridSize})`);
				break;
			case ElementRotation.up:
				leds.setAttribute('transform', `translate(${this.gridSize}, ${0.5 * this.gridSize})`);
				break;
		}
		this._group.appendChild(leds);

		return this._group;
	}

}
