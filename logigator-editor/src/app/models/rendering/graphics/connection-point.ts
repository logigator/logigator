import * as PIXi from 'pixi.js';
import { LGraphics } from './l-graphics';
import { getStaticDI } from '../../get-di';
import { ThemingService } from '../../../services/theming/theming.service';
import * as PIXI from 'pixi.js';
import { Grid } from '../grid';
import { Element } from '../../element';

export class ConnectionPoint extends PIXI.Graphics implements LGraphics {
	// to make compiler happy
	readonly element: Element;

	private _gridPos: PIXi.Point;
	private _isInChunk: boolean;

	private _isSelected: boolean;

	private themingService = getStaticDI(ThemingService);

	constructor(pos: PIXI.Point, isInChunk: boolean, scale: number) {
		super();
		this._gridPos = pos.clone();
		this._isInChunk = isInChunk;
		this._isSelected = false;
		this.drawConnPoint(scale);
	}

	private drawConnPoint(scale: number) {
		const size = scale < 0.5 ? 3 : 5;
		this.clear();
		this.beginFill(0xffffff);
		this.tint = this._isSelected
			? this.themingService.getEditorColor('wireSelectColor')
			: this.themingService.getEditorColor('wire');
		let pixelPos: PIXI.IPoint;
		if (this._isInChunk) {
			pixelPos = Grid.getLocalChunkPixelPosForGridPosWire(this._gridPos);
		} else {
			pixelPos = Grid.getPixelPosForGridPosWire(this._gridPos);
		}
		this.position = new PIXI.Point(
			pixelPos.x - size / 2 / scale,
			pixelPos.y - size / 2 / scale
		);
		this.drawRect(0, 0, size / scale, size / scale);
	}

	public setPosition(pos: PIXI.Point, isInChunk: boolean, scale: number) {
		this._isInChunk = isInChunk;
		this._gridPos = pos.clone();
		this.drawConnPoint(scale);
	}

	public addOffsetToPos(offset: PIXI.Point, scale: number) {
		this._gridPos.x += offset.x;
		this._gridPos.y += offset.y;
		this.drawConnPoint(scale);
	}

	public updateScale(scale: number) {
		this.drawConnPoint(scale);
	}

	public setSelected(selected: boolean) {
		this._isSelected = selected;
		if (this._isSelected) {
			this.tint = this.themingService.getEditorColor('wireSelectColor');
		} else {
			this.tint = this.themingService.getEditorColor('wire');
		}
	}

	applySimState() {}
	setSimulationState() {}
}
