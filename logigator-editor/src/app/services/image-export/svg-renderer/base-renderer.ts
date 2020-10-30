import {Element} from '../../../models/element';
import {RenderQuality} from '../svg-image-exporter';
import {ElementType} from '../../../models/element-types/element-type';
import * as PIXI from 'pixi.js';
import {Elements} from '../../../models/elements';
import {getStaticDI} from '../../../models/get-di';
import {ElementProviderService} from '../../element-provider/element-provider.service';
import {environment} from '../../../../environments/environment';

export abstract class BaseRenderer {
	protected readonly elementProvider = getStaticDI(ElementProviderService);
	protected readonly SVG_NS = 'http://www.w3.org/2000/svg';

	protected _elementType: ElementType;
	protected _size: PIXI.Point;
	protected _labels: string[];
	protected _group: SVGGElement;
	protected _element: Element;
	protected _gridSize: number;
	protected _quality: RenderQuality;

	public constructor(element: Element, gridSize: number, quality: RenderQuality) {
		this._element = element;
		this._gridSize = gridSize;
		this._quality = quality;

		this._elementType = this.elementProvider.getElementById(element.typeId);
		this._group = document.createElementNS(this.SVG_NS, 'g');

		this._size = Elements.calcElemSize(element);
		this._size.x *= gridSize;
		this._size.y *= gridSize;

		if (this._elementType.calcLabels) this._labels = this._elementType.calcLabels(element);
	}

	public abstract render(): SVGGElement;

	protected scaled(size: number) {
		return size * this._gridSize / environment.gridPixelWidth;
	}

	get elementType(): ElementType {
		return this._elementType;
	}

	get size(): PIXI.Point {
		return this._size;
	}

	get labels(): string[] {
		return this._labels;
	}

	get group(): SVGGElement {
		return this._group;
	}

	get element(): Element {
		return this._element;
	}

	get gridSize(): number {
		return this._gridSize;
	}

	get quality(): RenderQuality {
		return this._quality;
	}
}
