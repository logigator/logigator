import * as PIXI from 'pixi.js';
import { Grid } from './grid';

export class PosHelper {
	private readonly _startPosForDiff: PIXI.IPoint;

	private readonly _pixelPosStartDrag: PIXI.Point;

	private _lastPixelPosDrag: PIXI.Point;
	private _lastGridPosDrag: PIXI.Point;

	private _previousPixelPosDrag: PIXI.Point;

	constructor(
		e: PIXI.InteractionEvent,
		view: PIXI.DisplayObject,
		startPosForDiff?: PIXI.IPoint
	) {
		this._pixelPosStartDrag = e.data.getLocalPosition(view);
		this._lastPixelPosDrag = this._pixelPosStartDrag;
		this._previousPixelPosDrag = this._pixelPosStartDrag;
		this._lastGridPosDrag = Grid.getGridPosForPixelPos(this._pixelPosStartDrag);
		this._startPosForDiff = startPosForDiff || this._pixelPosStartDrag;
	}

	/**
	 * @return diff in pixelPos rounded to grid from last addDragPos() call, (0,0) if gridPos did not change
	 */
	public addDragPos(
		e: PIXI.InteractionEvent,
		view: PIXI.DisplayObject
	): PIXI.Point {
		const currentPos = e.data.getLocalPosition(view);
		this._previousPixelPosDrag = this._lastPixelPosDrag;
		this._lastPixelPosDrag = currentPos;
		const currGridPos = Grid.getGridPosForPixelPos(currentPos);
		const diff = new PIXI.Point(
			currGridPos.x - this._lastGridPosDrag.x,
			currGridPos.y - this._lastGridPosDrag.y
		);
		if (diff.x !== 0 || diff.y !== 0) this._lastGridPosDrag = currGridPos;
		return Grid.getPixelPosForGridPos(diff);
	}

	public get pixelPosStartDrag(): PIXI.Point {
		return this._pixelPosStartDrag;
	}

	public get gridPosStart(): PIXI.Point {
		return Grid.getGridPosForPixelPos(this._pixelPosStartDrag);
	}

	public get gridPosFloatStart(): PIXI.Point {
		return Grid.getFloatGridPosForPixelPos(this._pixelPosStartDrag);
	}

	public get pixelPosOnGridStart(): PIXI.Point {
		return Grid.getPixelPosOnGridForPixelPos(this._pixelPosStartDrag);
	}

	public get pixelPosOnGridStartWire(): PIXI.Point {
		return Grid.getPixelPosForGridPosWire(this.gridPosStart);
	}

	public get gridPosStartWire(): PIXI.Point {
		return Grid.getPixelPosForGridPosWire(this._pixelPosStartDrag);
	}

	public get lastPixelPosDrag(): PIXI.Point {
		return this._lastPixelPosDrag;
	}

	public get previousPixelPosDrag(): PIXI.Point {
		return this._previousPixelPosDrag;
	}

	public get lastGridPosDrag(): PIXI.Point {
		return this._lastGridPosDrag;
	}

	public get lastPixelPosOnGridWire(): PIXI.Point {
		return Grid.getPixelPosForGridPosWire(this.lastGridPosDrag);
	}

	public get lastGridPosFloat(): PIXI.Point {
		return Grid.getFloatGridPosForPixelPos(this._lastPixelPosDrag);
	}

	public get previousGridPosFloat(): PIXI.Point {
		return Grid.getFloatGridPosForPixelPos(this._previousPixelPosDrag);
	}

	public getGridPosDiffFromStart(toCalcDifFrom?: PIXI.IPoint): PIXI.Point {
		toCalcDifFrom = toCalcDifFrom || this._lastPixelPosDrag;
		return Grid.getGridPosForPixelPos(
			new PIXI.Point(
				toCalcDifFrom.x - this._startPosForDiff.x,
				toCalcDifFrom.y - this._startPosForDiff.y
			)
		);
	}

	public getPixelPosDiffFromStart(toCalcDifFrom?: PIXI.IPoint): PIXI.Point {
		toCalcDifFrom = toCalcDifFrom || this._lastPixelPosDrag;
		return new PIXI.Point(
			toCalcDifFrom.x - this._startPosForDiff.x,
			toCalcDifFrom.y - this._startPosForDiff.y
		);
	}

	public get pixelDiffFromPreviousDrag(): PIXI.Point {
		return new PIXI.Point(
			this._lastPixelPosDrag.x - this._previousPixelPosDrag.x,
			this._lastPixelPosDrag.y - this._previousPixelPosDrag.y
		);
	}

	public get floatGridDiffFromPreviousDrag(): PIXI.Point {
		return Grid.getFloatGridPosForPixelPos(this.pixelDiffFromPreviousDrag);
	}
}
