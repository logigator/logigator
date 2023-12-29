import { BaseRenderer } from './base-renderer';
import { ElementRotation } from '../../../models/element';
import { RenderQuality } from '../svg-image-exporter';

export class DefaultRenderer extends BaseRenderer {
	public render(): SVGGElement {
		let path;

		// Outline, corners could be removed for lower quality presets
		switch (this.element.rotation) {
			case ElementRotation.Right:
				path = `M 0,0 H ${this._size.x - this.scaled(3)} L ${
					this._size.x
				},${this.scaled(3)} V ${this._size.y - this.scaled(3)} L ${
					this._size.x - this.scaled(3)
				},${this._size.y} H 0 V 0`;
				break;
			case ElementRotation.Down:
				path = `M 0,0 h ${this._size.x} v ${
					this._size.y - this.scaled(3)
				} l ${-this.scaled(3)},${this.scaled(3)} H ${this.scaled(3)} L 0,${
					this._size.y - this.scaled(3)
				} V 0`;
				break;
			case ElementRotation.Left:
				path = `M ${this.scaled(3)},0 H ${this._size.x} v ${
					this._size.y
				} H ${this.scaled(3)} L 0,${
					this._size.y - this.scaled(3)
				} V ${this.scaled(3)} L ${this.scaled(3)},0`;
				break;
			case ElementRotation.Up:
				path = `M ${this.scaled(3)},0 H ${this._size.x - this.scaled(3)} L ${
					this._size.x
				},${this.scaled(3)} V ${this._size.y} H 0 V ${this.scaled(
					3
				)} L ${this.scaled(3)},0`;
				break;
		}

		// Wire ends
		if (this._quality >= RenderQuality.high) {
			switch (this.element.rotation) {
				case ElementRotation.Right:
					for (let i = 0; i < this._element.numInputs; i++) {
						path += ` M ${-(this._gridSize / 2)},${
							this._gridSize / 2 + this._gridSize * i
						} h ${this._gridSize / 2}`;
					}
					for (let i = 0; i < this._element.numOutputs; i++) {
						path += ` M ${this._size.x},${
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
					for (let i = 0; i < this._element.numOutputs; i++) {
						path += ` M ${
							this._size.x - this._gridSize / 2 - this._gridSize * i
						},${this._size.y} v ${this._gridSize / 2}`;
					}
					break;
				case ElementRotation.Left:
					for (let i = 0; i < this._element.numInputs; i++) {
						path += ` M ${this._size.x},${
							this._size.y - this._gridSize / 2 - this._gridSize * i
						} h ${this._gridSize / 2}`;
					}
					for (let i = 0; i < this._element.numOutputs; i++) {
						path += ` M 0,${
							this._size.y - this._gridSize / 2 - this._gridSize * i
						} h ${-this._gridSize / 2}`;
					}
					break;
				case ElementRotation.Up:
					for (let i = 0; i < this._element.numInputs; i++) {
						path += ` M ${this._gridSize / 2 + this._gridSize * i},${
							this._size.y
						} v ${this._gridSize / 2}`;
					}
					for (let i = 0; i < this._element.numOutputs; i++) {
						path += ` M ${this._gridSize / 2 + this._gridSize * i},0 v ${
							-this._gridSize / 2
						}`;
					}
					break;
			}
		}

		const element = document.createElementNS(this.SVG_NS, 'path');
		element.setAttribute('d', path);
		element.setAttribute('class', 'c');
		this._group.appendChild(element);

		// Labels
		if (this._quality >= RenderQuality.full && this._labels) {
			switch (this._element.rotation) {
				case ElementRotation.Right:
					for (let i = 0; i < this._element.numInputs; i++) {
						if (!this._labels[i]) continue;
						const label = this.getLabelText(
							this._labels[i],
							2,
							this._gridSize / 2 + this._gridSize * i + this.scaled(2)
						);
						label.setAttribute('class', 'l-l');
						this._group.appendChild(label);
					}
					for (let i = 0; i < this._element.numOutputs; i++) {
						if (!this._labels[this._element.numInputs + i]) continue;
						const label = this.getLabelText(
							this._labels[this._element.numInputs + i],
							this._size.x - 2,
							this._gridSize / 2 + this._gridSize * i + this.scaled(2)
						);
						label.setAttribute('class', 'l-r');
						this._group.appendChild(label);
					}
					break;
				case ElementRotation.Down:
					for (let i = 0; i < this._element.numInputs; i++) {
						if (!this._labels[i]) continue;
						const label = this.getLabelText(
							this._labels[i],
							this._size.x - this._gridSize / 2 - this._gridSize * i,
							this.scaled(6)
						);
						label.setAttribute('class', 'l-t');
						this._group.appendChild(label);
					}
					for (let i = 0; i < this._element.numOutputs; i++) {
						if (!this._labels[this._element.numInputs + i]) continue;
						const label = this.getLabelText(
							this._labels[this._element.numInputs + i],
							this._size.x - this._gridSize / 2 - this._gridSize * i,
							this._size.y - this.scaled(3)
						);
						label.setAttribute('class', 'l-b');
						this._group.appendChild(label);
					}
					break;
				case ElementRotation.Left:
					for (let i = 0; i < this._element.numInputs; i++) {
						if (!this._labels[i]) continue;
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
					for (let i = 0; i < this._element.numOutputs; i++) {
						if (!this._labels[this._element.numInputs + i]) continue;
						const label = this.getLabelText(
							this._labels[this._element.numInputs + i],
							2,
							this._size.y -
								this._gridSize / 2 -
								this._gridSize * i +
								this.scaled(2)
						);
						label.setAttribute('class', 'l-l');
						this._group.appendChild(label);
					}
					break;
				case ElementRotation.Up:
					for (let i = 0; i < this._element.numInputs; i++) {
						if (!this._labels[i]) continue;
						const label = this.getLabelText(
							this._labels[i],
							this._gridSize / 2 + this._gridSize * i,
							this._size.y - this.scaled(3)
						);
						label.setAttribute('class', 'l-b');
						this._group.appendChild(label);
					}
					for (let i = 0; i < this._element.numOutputs; i++) {
						if (!this._labels[this._element.numInputs + i]) continue;
						const label = this.getLabelText(
							this._labels[this._element.numInputs + i],
							this._gridSize / 2 + this._gridSize * i,
							this.scaled(6)
						);
						label.setAttribute('class', 'l-t');
						this._group.appendChild(label);
					}
					break;
			}
		}

		// Symbol
		if (this._quality >= RenderQuality.high) {
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
