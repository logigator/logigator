import {Project} from '../../models/project';
import {Element} from '../../models/element';
import * as PIXI from 'pixi.js';
import {environment} from '../../../environments/environment';
import {getStaticDI} from '../../models/get-di';
import {ThemingService} from '../theming/theming.service';
import {ElementProviderService} from '../element-provider/element-provider.service';
import {Grid} from '../../models/rendering/grid';

export class SvgImageExporter {

	private readonly SVG_NS = 'http://www.w3.org/2000/svg';

	private readonly themingService = getStaticDI(ThemingService);
	private readonly elementProvider = getStaticDI(ElementProviderService);

	private readonly _svg: SVGElement;

	private size = new PIXI.Point(0, 0);

	constructor(private project: Project) {
		this._svg = document.createElementNS(this.SVG_NS, 'svg');
		this.generateStyles();
		for (const action of this.project.getOpenActions()) {
			switch (action.name) {
				case 'addComp':
					this.placeComp(action.element);
					break;
				case 'addWire':
					this.placeWire(action.element);
					break;
				case 'conWire':
					this.placeConnPoint(action.pos);
					break;
			}
		}
		this._svg.setAttribute('height', this.size.y + '');
		this._svg.setAttribute('width', this.size.x + '');
	}

	private placeComp(element: Element) {
		const elemType = this.elementProvider.getElementById(element.typeId);

		let width;
		let height;
		if (element.rotation === 0 || element.rotation === 2) {
			width = environment.gridPixelWidth * elemType.width;
			height = element.numInputs >= element.numOutputs ?
				environment.gridPixelWidth * element.numInputs :
				environment.gridPixelWidth * element.numOutputs;
		} else {
			width = element.numInputs >= element.numOutputs ?
				environment.gridPixelWidth * element.numInputs :
				environment.gridPixelWidth * element.numOutputs;
			height = environment.gridPixelWidth * elemType.width;
		}

		const group = document.createElementNS(this.SVG_NS, 'g');
		const rect = document.createElementNS(this.SVG_NS, 'rect');
		rect.setAttribute('x', '0');
		rect.setAttribute('y', '0');
		rect.setAttribute('width', width + '');
		rect.setAttribute('height', height + '');
		rect.setAttribute('class', 'wire');
		group.appendChild(rect);
		const pos = Grid.getPixelPosForGridPos(element.pos);
		group.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
		this.updateSize(Grid.getPixelPosForGridPos(element.endPos));
		this._svg.appendChild(group);
	}

	private placeWire(element: Element) {
		const wire = document.createElementNS(this.SVG_NS, 'line');
		const startPos = Grid.getPixelPosForGridPosWire(element.pos);
		const endPos = Grid.getPixelPosForGridPosWire(element.endPos);
		wire.setAttribute('x1', startPos.x + '');
		wire.setAttribute('y1', startPos.y + '');
		wire.setAttribute('x2', endPos.x + '');
		wire.setAttribute('y2', endPos.y + '');
		wire.setAttribute('class', 'wire');

		this.updateSize(endPos);
		this._svg.appendChild(wire);
	}

	private placeConnPoint(pos: PIXI.Point) {

	}

	private generateStyles() {
		const defs = document.createElement('defs');
		const styles = document.createElement('style');
		styles.setAttribute('type', 'text/css');
		styles.innerHTML = `
			.wire {
				stroke: #${this.themingService.getEditorColor('wire').toString(16)};
				stroke-width: 1px;
				fill: none;
			}
		`;
		defs.appendChild(styles);
		this._svg.appendChild(defs);
		this._svg.setAttribute('style', `background-color: #${this.themingService.getEditorColor('background').toString(16)}`);
	}

	private updateSize(pos: PIXI.Point) {
		if (pos.x > this.size.x) this.size.x = pos.x;
		if (pos.y > this.size.y) this.size.y = pos.y;
	}

	public getSVGDownloadString(): string {
		const serializer = new XMLSerializer();
		let source = serializer.serializeToString(this._svg);
		if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
			source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
		}
		if (!source.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
			source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
		}
		source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
		return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
	}

}
