import * as PIXI from 'pixi.js';
import InteractionEvent = PIXI.interaction.InteractionEvent;
import {Grid} from './grid';

export class PosHelper {

	private readonly _pixelPosStart: PIXI.Point;

	private _lastPixelPos: PIXI.Point;
	private _lastGridPos: PIXI.Point;

	constructor(e: InteractionEvent, view: PIXI.DisplayObject) {
		this._pixelPosStart = e.data.getLocalPosition(view);
		this._lastPixelPos = this._pixelPosStart;
		this._lastGridPos = Grid.getGridPosForPixelPos(this._pixelPosStart);
	}

	/**
	 * @return diff in pixelPos from last addDragPos() call, (0,0) if gridPos did not change
	 */
	public addDragPos(e: InteractionEvent, view: PIXI.DisplayObject): PIXI.Point {
		const currentPos = e.data.getLocalPosition(view);
		this._lastPixelPos = currentPos;
		const currGridPos = Grid.getGridPosForPixelPos(currentPos);
		const diff = new PIXI.Point(currGridPos.x - this._lastGridPos.x, currGridPos.y - this._lastGridPos.y);
		if (diff.x !== 0 || diff.y !== 0) this._lastGridPos = currGridPos;
		return Grid.getPixelPosForGridPos(diff);
	}

	public get pixelPosStart(): PIXI.Point {
		return this._pixelPosStart;
	}

	public get gridPosStart(): PIXI.Point {
		return Grid.getGridPosForPixelPos(this._pixelPosStart);
	}

	public get pixelPosOnGridStart(): PIXI.Point {
		return Grid.getPixelPosOnGridForPixelPos(this._pixelPosStart);
	}

	public get gridPosStartWire(): PIXI.Point {
		return Grid.getPixelPosForGridPosWire(this._pixelPosStart);
	}

	public get lastPixelPos(): PIXI.Point {
		return this._lastPixelPos;
	}

	public get lastGridPos(): PIXI.Point {
		return this._lastGridPos;
	}

	public get gridPosDifFFromStart(): PIXI.Point {
		const startGridPos = this.gridPosStart;
		return new PIXI.Point(this._lastGridPos.x - startGridPos.x, this._lastPixelPos.y - startGridPos.y);
	}
}
