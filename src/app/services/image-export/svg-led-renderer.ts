import {Element} from '../../models/element';
import {Grid} from '../../models/rendering/grid';
import {environment} from '../../../environments/environment';
import * as PIXI from 'pixi.js';

export class SvgLedRenderer {

	private readonly SVG_NS = 'http://www.w3.org/2000/svg';

	private readonly _group: SVGGElement;

	constructor(private element: Element, private offset: PIXI.Point) {
		this._group = document.createElementNS(this.SVG_NS, 'g');
		this.renderLed();
		const pos = Grid.getPixelPosForGridPos(new PIXI.Point(element.pos.x - this.offset.x, element.pos.y - this.offset.y));
		this._group.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
	}

	private renderLed() {
		const led = document.createElementNS(this.SVG_NS, 'circle');
		led.setAttribute('cx', environment.gridPixelWidth / 2 + '');
		led.setAttribute('cy', environment.gridPixelWidth / 2 + '');
		led.setAttribute('r', environment.gridPixelWidth / 2 + '');
		led.setAttribute('class', 'led');
		this._group.appendChild(led);

		const input = document.createElementNS(this.SVG_NS, 'line');
		switch (this.element.rotation) {
			case 0:
				input.setAttribute('x1', -environment.gridPixelWidth / 2 + '');
				input.setAttribute('y1', environment.gridPixelWidth / 2 + '');
				input.setAttribute('x2', '0');
				input.setAttribute('y2', environment.gridPixelWidth / 2 + '');
				break;
			case 1:
				input.setAttribute('x1', environment.gridPixelWidth / 2 + '');
				input.setAttribute('y1', '0');
				input.setAttribute('x2', environment.gridPixelWidth / 2 + '');
				input.setAttribute('y2', -environment.gridPixelWidth / 2 + '');
				break;
			case 2:
				input.setAttribute('x1', environment.gridPixelWidth / 2 + '');
				input.setAttribute('y1', environment.gridPixelWidth / 2 + '');
				input.setAttribute('x2', environment.gridPixelWidth * 1.5 + '');
				input.setAttribute('y2', environment.gridPixelWidth / 2 + '');
				break;
			case 3:
				input.setAttribute('x1', environment.gridPixelWidth / 2 + '');
				input.setAttribute('y1', environment.gridPixelWidth + '');
				input.setAttribute('x2', environment.gridPixelWidth / 2 + '');
				input.setAttribute('y2', environment.gridPixelWidth * 1.5 + '');
				break;
		}
		input.setAttribute('class', 'wire');
		this._group.appendChild(input);
	}

	public getSVGGroup(): SVGGElement {
		return this._group;
	}
}
