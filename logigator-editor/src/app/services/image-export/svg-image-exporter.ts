import {Project} from '../../models/project';
import {Element} from '../../models/element';
import * as PIXI from 'pixi.js';
import {getStaticDI} from '../../models/get-di';
import {ThemingService} from '../theming/theming.service';
import {environment} from '../../../environments/environment';
import {DefaultRenderer} from './svg-renderer/default-renderer';
import {ElementTypeId} from '../../models/element-types/element-type-ids';

export class SvgImageExporter {

	private readonly SVG_NS = 'http://www.w3.org/2000/svg';
	private readonly themingService = getStaticDI(ThemingService);
	private readonly _svg: SVGElement;

	public readonly size = new PIXI.Point(0, 0);
	public readonly offset = new PIXI.Point(0, 0);
	public readonly scaleFactor;
	public readonly gridSize: number;
	public readonly quality: RenderQuality = 'full';
	public readonly theme: 'dark' | 'light';

	constructor(private project: Project, size?: PIXI.Point, theme?: 'dark' | 'light') {
		this._svg = document.createElementNS(this.SVG_NS, 'svg');
		this.theme = theme ?? 'dark';
		this.generateStyles();

		let minX = Number.MAX_SAFE_INTEGER, minY = Number.MAX_SAFE_INTEGER, maxX = 0, maxY = 0;

		for (const action of this.project.getOpenActions()) {
			if (action.name !== 'addComp' && action.name !== 'addWire')
				continue;

			if (action.pos.x < minX)
				minX = action.pos.x;
			if (action.pos.y < minY)
				minY = action.pos.y;
			if (action.endPos.x > maxX)
				maxX = action.endPos.x;
			if (action.endPos.y > maxY)
				maxY = action.endPos.y;
		}

		minX--;
		minY--;
		maxX++;
		maxY++;

		this.scaleFactor = 1;
		if (size) {
			this.size = size;
			this.gridSize = size.x / (maxX - minX) < size.y / (maxY - minY) ? size.x / (maxX - minX) : size.y / (maxY - minY);
			if (this.gridSize < 2) {
				this.gridSize = 2;
				this.scaleFactor = size.x / (maxX - minX) < size.y / (maxY - minY) ? size.x / (maxX - minX) / 2 : size.y / (maxY - minY) / 2;
				this.size.x /= this.scaleFactor;
				this.size.y /= this.scaleFactor;
				if (this.scaleFactor > 0.5)
					this.quality = 'high';
				else
					this.quality = 'low';
			}
		} else {
			this.gridSize = environment.gridPixelWidth;
			this.size.x = (maxX - minX) * this.gridSize;
			this.size.y = (maxY - minY) * this.gridSize;
		}

		this.offset.x = Math.trunc(-minX * this.gridSize + 1 + (this.size.x - (maxX - minX) * this.gridSize) / 2) + 0.5;
		this.offset.y = Math.trunc(-minY * this.gridSize + 1 + (this.size.y - (maxY - minY) * this.gridSize) / 2) + 0.5;

		this._svg.setAttribute('height', this.size.y + '');
		this._svg.setAttribute('width', this.size.x + '');

		console.log(minX);
		console.log(minY);
		console.log(maxX);
		console.log(maxY);
		console.log(this.offset);
		console.log(this.gridSize);
		console.log(this.size);
		console.log(this.scaleFactor);
		console.log(this.quality);

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
	}

	private placeComp(element: Element) {
		let group: SVGGElement;
		switch (element.typeId) {
			case ElementTypeId.TEXT:
			case ElementTypeId.LED:
			case ElementTypeId.LED_MATRIX:
				break;
			default:
				group = new DefaultRenderer().render(element, this.gridSize, this.quality);
		}
		if (group) {
			group.setAttribute('transform', `translate(${element.pos.x * this.gridSize + this.offset.x}, ${element.pos.y * this.gridSize + this.offset.y})`);
			this._svg.appendChild(group);
		}
	}

	private placeWire(element: Element) {
		const wire = document.createElementNS(this.SVG_NS, 'line');
		wire.setAttribute('x1', (element.pos.x + 0.5) * this.gridSize + this.offset.x + '');
		wire.setAttribute('y1', (element.pos.y + 0.5) * this.gridSize + this.offset.y + '');
		wire.setAttribute('x2', (element.endPos.x + 0.5) * this.gridSize + this.offset.x + '');
		wire.setAttribute('y2', (element.endPos.y + 0.5) * this.gridSize + this.offset.y + '');
		wire.setAttribute('class', 'w');
		this._svg.appendChild(wire);
	}

	private placeConnPoint(pos: PIXI.Point) {
		const point = document.createElementNS(this.SVG_NS, 'rect');
		point.setAttribute('x', (pos.x + 0.5) * this.gridSize + this.offset.x - 2.5 + '');
		point.setAttribute('y', (pos.y + 0.5) * this.gridSize + this.offset.y - 2.5 + '');
		point.setAttribute('width', '5');
		point.setAttribute('height', '5');
		point.setAttribute('class', 'cp');
		this._svg.appendChild(point);
	}

	private generateStyles() {
		const defs = document.createElement('defs');
		const styles = document.createElement('style');
		styles.setAttribute('type', 'text/css');
		styles.innerHTML = `
			text {
				fill: #${this.themingService.getEditorColor('fontTint').toString(16)};
				font-family: Roboto, Arial, sans-serif;
			}
			.body {
				background-color: #${this.themingService.getEditorColor('background').toString(16)}
			}
			.w {
				stroke: #${this.themingService.getEditorColor('wire').toString(16)};
				stroke-width: 1px;
				fill: none;
				vector-effect: non-scaling-stroke;
			}
			.cp {
				fill: #${this.themingService.getEditorColor('wire').toString(16)};
			}
			.symbol {
				text-anchor: middle;
				font-size: 8px;
			}
			.text {
				text-anchor: start;
			}
			.led {
				fill: #${this.themingService.getEditorColor('wire').toString(16)};
			}
			.l-l {
				text-anchor: start;
				font-size: ${environment.gridPixelWidth * 0.3}px;
			}
			.l-r {
				text-anchor: end;
				font-size: ${environment.gridPixelWidth * 0.3}px;
			}
			.l-t {
				text-anchor: middle;
				font-size: ${environment.gridPixelWidth * 0.3}px;
			}
			.l-b {
				text-anchor: middle;
				font-size: ${environment.gridPixelWidth * 0.3}px;
			}
		`;
		defs.appendChild(styles);
		this._svg.appendChild(defs);
		this._svg.setAttribute('class', 'body');
	}

	public serializeSVG(): string {
		const serializer = new XMLSerializer();
		console.time('serialize');
		let source = serializer.serializeToString(this._svg);
		console.timeEnd('serialize');
		console.time('regex');
		if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
			source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
		}
		if (!source.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
			source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
		}
		console.timeEnd('regex');
		return '<?xml version="1.0" standalone="no"?>\r\n' + source;
	}

	public getBase64String(): string {
		return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(this.serializeSVG())));
	}
}

export type RenderQuality = 'low' | 'high' | 'full';
