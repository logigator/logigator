import {Element} from '../../models/element';
import {Grid} from '../../models/rendering/grid';
import {environment} from '../../../environments/environment';
import {TextData} from '../../models/element-types/basic/text';
import * as PIXI from 'pixi.js';
import {getStaticDI} from '../../models/get-di';
import {ThemingService} from '../theming/theming.service';

export class SvgTextRenderer {

	private readonly SVG_NS = 'http://www.w3.org/2000/svg';

	private readonly _group: SVGGElement;

	private readonly themingService = getStaticDI(ThemingService);

	constructor(private element: Element, private offset: PIXI.Point) {
		this._group = document.createElementNS(this.SVG_NS, 'g');
		this.renderText();
		const pos = Grid.getPixelPosForGridPos(new PIXI.Point(element.pos.x - this.offset.x, element.pos.y - this.offset.y));
		this._group.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
	}

	private renderText() {
		const point = document.createElementNS(this.SVG_NS, 'rect');
		point.setAttribute('x', environment.gridPixelWidth / 2 - 2.5 + '');
		point.setAttribute('y', environment.gridPixelWidth / 2 - 2.5 + '');
		point.setAttribute('width', '5');
		point.setAttribute('height', '5');
		point.setAttribute('fill', '#' + this.themingService.getEditorColor('wire').toString(16));
		this._group.appendChild(point);

		const textParts = (this.element.data as TextData).split('\n');
		for (let i = 0; i < textParts.length; i++) {
			const text = document.createElementNS(this.SVG_NS, 'text');
			text.textContent = textParts[i];
			text.setAttribute('class', 'text');
			text.setAttribute('font-size', '16');
			text.setAttribute('x', environment.gridPixelWidth + '');
			text.setAttribute('y',  environment.gridPixelWidth / 2 + environment.gridPixelWidth * i + 6 + '');
			this._group.appendChild(text);
		}
	}

	public getSVGGroup(): SVGGElement {
		return this._group;
	}
}
