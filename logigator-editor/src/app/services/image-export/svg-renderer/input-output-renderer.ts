import { BaseRenderer } from './base-renderer';
import { RenderQuality } from '../svg-image-exporter';
import { ElementRotation } from '../../../models/element';
import { ElementTypeId } from '../../../models/element-types/element-type-ids';
import { getStaticDI } from '../../../models/get-di';
import { FontWidthService } from '../../font-width/font-width.service';

export class InputOutputRenderer extends BaseRenderer {
	render(): SVGGElement {
		let path = ` M 0,0 h ${this.gridSize} v ${this.gridSize} H 0 V 0`;
		if (this.quality >= RenderQuality.high) {
			let rotation = this.element.rotation;
			if (this.element.typeId === ElementTypeId.OUTPUT)
				rotation = (rotation + 2) % 4;
			switch (rotation) {
				case ElementRotation.Right:
					path += ` M ${this.gridSize},${this.gridSize / 2} h ${
						this.gridSize / 2
					}`;
					break;
				case ElementRotation.Down:
					path += ` M ${this.gridSize / 2},${this.gridSize} v ${
						this.gridSize / 2
					}`;
					break;
				case ElementRotation.Left:
					path += ` M 0,${this.gridSize / 2} h ${-this.gridSize / 2}`;
					break;
				case ElementRotation.Up:
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
			const symbolText =
				(this.element.data as string) ?? this._elementType.symbol;
			symbol.textContent = symbolText;
			symbol.setAttribute(
				'style',
				`font-size: ${this.calcSymbolFontSize(symbolText)}px`
			);
			symbol.setAttribute('class', 's');
			symbol.setAttribute('x', this._size.x / 2 + '');
			symbol.setAttribute('y', this._size.y / 2 + '');
			this._group.appendChild(symbol);

			const plugIndex = document.createElementNS(this.SVG_NS, 'text');
			plugIndex.textContent = this.getPlugIndex();
			plugIndex.setAttribute('class', 'pi');
			plugIndex.setAttribute('x', this._size.x / 2 + '');
			plugIndex.setAttribute('y', this._size.y - this.scaled(1) + '');
			this._group.appendChild(plugIndex);
		}

		return this._group;
	}

	private calcSymbolFontSize(symbol: string): number {
		const textWidth = getStaticDI(FontWidthService).getTextWidth(
			symbol,
			'10px Roboto'
		);
		const adjustedSize = 10 * ((this.size.x * 0.8) / textWidth);
		return adjustedSize < this.size.x * 0.6 ? adjustedSize : this.size.x * 0.6;
	}

	private getPlugIndex(): string {
		if (this.element.typeId === ElementTypeId.INPUT) {
			return this.element.plugIndex + 1 + '';
		} else {
			return this.element.plugIndex - this.project.numInputs + 1 + '';
		}
	}
}
