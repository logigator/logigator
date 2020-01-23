import {Project} from '../../models/project';
import {Element} from '../../models/element';
import * as PIXI from 'pixi.js';
import {getStaticDI} from '../../models/get-di';
import {ThemingService} from '../theming/theming.service';
import {Grid} from '../../models/rendering/grid';
import {SvgCompRenderer} from './svg-comp-renderer';
import {ElementTypeId} from '../../models/element-types/element-type-ids';
import {SvgTextRenderer} from './svg-text-renderer';
import {environment} from '../../../environments/environment';
import {SvgLedRenderer} from './svg-led-renderer';

export class SvgImageExporter {

	private readonly SVG_NS = 'http://www.w3.org/2000/svg';

	private readonly themingService = getStaticDI(ThemingService);

	private readonly _svg: SVGElement;

	private size = new PIXI.Point(0, 0);
	private offset = new PIXI.Point(0, 0);

	constructor(private project: Project) {
		this._svg = document.createElementNS(this.SVG_NS, 'svg');
		this.generateStyles();

		this.offset.x = Number.MAX_SAFE_INTEGER;
		this.offset.y = Number.MAX_SAFE_INTEGER;

		for (let i = 0; i < this.project.currState.chunks.length; i++) {
			for (let j = 0; j < this.project.currState.chunks[i].length; j++) {
				if (this.project.currState.chunks[i][j] && this.project.currState.chunks[i][j].elements.length) {
					if (i < this.offset.x)
						this.offset.x = i;
					if (j < this.offset.y)
						this.offset.y = j;
					break;
				}
			}
		}
		this.offset.x *= environment.chunkSize;
		this.offset.y *= environment.chunkSize;

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
		this._svg.setAttribute('height', this.height + '');
		this._svg.setAttribute('width', this.width + '');
	}

	private placeComp(element: Element) {
		if (element.typeId === ElementTypeId.TEXT) {
			const textRender = new SvgTextRenderer(element, this.offset);
			this._svg.appendChild(textRender.getSVGGroup());
			this.updateSize(Grid.getPixelPosForGridPos(new PIXI.Point(element.pos.x - this.offset.x, element.pos.y - this.offset.y)));
		} else if (element.typeId === ElementTypeId.LED) {
			const textRender = new SvgLedRenderer(element, this.offset);
			this._svg.appendChild(textRender.getSVGGroup());
			this.updateSize(Grid.getPixelPosForGridPos(new PIXI.Point(element.pos.x - this.offset.x, element.pos.y - this.offset.y)));
		} else {
			const compRenderer = new SvgCompRenderer(element, this.offset);
			this._svg.appendChild(compRenderer.getSVGGroup());
			this.updateSize(Grid.getPixelPosForGridPos(new PIXI.Point(element.endPos.x - this.offset.x, element.endPos.y - this.offset.y)));
		}

	}

	private placeWire(element: Element) {
		const wire = document.createElementNS(this.SVG_NS, 'line');
		const startPos = Grid.getPixelPosForGridPosWire(new PIXI.Point(element.pos.x - this.offset.x, element.pos.y - this.offset.y));
		const endPos = Grid.getPixelPosForGridPosWire(new PIXI.Point(element.endPos.x - this.offset.x, element.endPos.y - this.offset.y));
		wire.setAttribute('x1', startPos.x + '');
		wire.setAttribute('y1', startPos.y + '');
		wire.setAttribute('x2', endPos.x + '');
		wire.setAttribute('y2', endPos.y + '');
		wire.setAttribute('class', 'wire');

		this.updateSize(endPos);
		this._svg.appendChild(wire);
	}

	private placeConnPoint(pos: PIXI.Point) {
		const point = document.createElementNS(this.SVG_NS, 'rect');
		const pixelPos = Grid.getPixelPosForGridPosWire(new PIXI.Point(pos.x - this.offset.x, pos.y - this.offset.y));
		pixelPos.x -= 2;
		pixelPos.y -= 2;
		point.setAttribute('x', pixelPos.x + '');
		point.setAttribute('y', pixelPos.y + '');
		point.setAttribute('width', '4');
		point.setAttribute('height', '4');
		point.setAttribute('fill', '#' + this.themingService.getEditorColor('wire').toString(16));
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
			.wire {
				stroke: #${this.themingService.getEditorColor('wire').toString(16)};
				stroke-width: 1px;
				fill: none;
				vector-effect: non-scaling-stroke;
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
		this._svg.setAttribute('style', `background-color: #${this.themingService.getEditorColor('background').toString(16)}`);
	}

	private updateSize(pos: PIXI.Point) {
		if (pos.x > this.size.x) this.size.x = pos.x;
		if (pos.y > this.size.y) this.size.y = pos.y;
	}

	public serializeSVG(): string {
		const serializer = new XMLSerializer();
		let source = serializer.serializeToString(this._svg);
		if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
			source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
		}
		if (!source.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
			source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
		}
		return '<?xml version="1.0" standalone="no"?>\r\n' + source;
	}

	public getBase64String(): string {
		return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(this.serializeSVG())));
	}

	public get width(): number {
		return this.size.x + environment.gridPixelWidth;
	}

	public get height(): number {
		return this.size.y + environment.gridPixelWidth;
	}
}
