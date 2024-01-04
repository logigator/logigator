import { Graphics, Matrix, Point } from 'pixi.js';

import { ElementType } from '../../models/element/element-type';
import { ElementCategory } from '../../models/element/element-category';
import { ComponentOption } from './component-option';
import { environment } from '../../../environments/environment';
import { ElementRotation } from '../../models/element-rotation';
import { wireGeometry } from './geometries/wire.geometry';

export abstract class Component extends Graphics {

	public abstract readonly type: ElementType;
	public abstract readonly category: ElementCategory;
	public abstract readonly options: ComponentOption[];

	private _pos: Point;
	private _endPos: Point;
	private _rotation: ElementRotation;

	private _numInputs: number;
	private _numOutputs: number;

	protected constructor(
		numInputs: number,
		numOutputs: number,
		rotation: ElementRotation,
		pos: Point,
		endPos: Point
	) {
		super();

		this._numInputs = numInputs;
		this._numOutputs = numOutputs;
		this._rotation = rotation;
		this._pos = pos;
		this._endPos = endPos;

		this.draw();
	}

	protected abstract get labels(): string[];

	public get numInputs(): number {
		return this._numInputs;
	}

	public set numInputs(value: number) {
		this._numInputs = value;
	}

	public get numOutputs(): number {
		return this._numOutputs;
	}

	public set numOutputs(value: number) {
		this._numOutputs = value;
	}

	public get rotationMatrix(): Matrix {
		const width = this._endPos.x - this._pos.x;
		const height = this._endPos.y - this._pos.y;
		const center = new Point(this._pos.x + width / 2, this._pos.y + height / 2);

		return Matrix.IDENTITY
			.translate(-center.x, -center.y)
			.rotate(this._rotation * Math.PI / 2)
			.translate(center.x, center.y);
	}

	private rotatePoint(point: Point): Point {
		return this.rotationMatrix.apply(point);
	}

	public get inputConnections(): Point[] {
		const inputs = [];
		for (let i = 0; i < this.numInputs; i++) {
			inputs.push(this.rotatePoint(
				new Point(0.5, 0.5 + i)
			));
		}

		return inputs;
	}

	protected fromGrid(point: Point): Point {
		return new Point(point.x * environment.gridPixelWidth, point.y * environment.gridPixelWidth);
	}

	private draw(): void {
		this.drawInputs();
	}

	private drawInputs(): void {
		for (const connection of this.inputConnections) {
			const child = new Graphics(wireGeometry());
			child.position = this.fromGrid(connection);
			child.scale = new Point(environment.gridPixelWidth, 1);
			this.addChild(child);
		}
	}
}
