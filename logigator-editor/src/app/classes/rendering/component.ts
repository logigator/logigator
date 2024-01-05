import { Graphics, Matrix, Point } from 'pixi.js';

import { ElementType } from '../../models/element/element-type';
import { ElementCategory } from '../../models/element/element-category';
import { ComponentOption } from '../component-option/component-option';
import { environment } from '../../../environments/environment';
import { ElementRotation } from '../../models/element-rotation';
import { wireGeometry } from './geometries/wire.geometry';

export interface ComponentConfig {
	name: string;
	type: ElementType;
	description: string;
	category: ElementCategory;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	options: ComponentOption<any>[];
	generate: (options: ComponentOption<unknown>[]) => Component;
}

export class ScalingGraphics extends Graphics {
	public constantScaleX = false;
	public constantScaleY = false;
	public constantScaleChildren = false;

	applyConstantScale(scale: number) {
		if (this.constantScaleX) {
			this.scale.x = 1 / scale;
		}
		if (this.constantScaleY) {
			this.scale.y = 1 / scale;
		}
		if (this.constantScaleChildren) {
			for (const child of this.children) {
				if (child instanceof ScalingGraphics) {
					child.applyConstantScale(scale);
				}
			}
		}
	}
}

export abstract class Component extends ScalingGraphics {
	override constantScaleChildren = true;
	override sortableChildren = false;

	public abstract readonly config: ComponentConfig;
	public readonly options: ComponentOption<unknown>[];

	private _rotation: ElementRotation;

	private _numInputs: number;
	private _numOutputs: number;

	private _inputsGraphics: ScalingGraphics = new ScalingGraphics();

	protected constructor(
		numInputs: number,
		numOutputs: number,
		rotation: ElementRotation,
		options: ComponentOption<unknown>[]
	) {
		super();

		this._numInputs = numInputs;
		this._numOutputs = numOutputs;
		this._rotation = rotation;
		this._inputsGraphics.constantScaleChildren = true;

		this.options = options;
		this.options[0].value;

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

	public get gridWidth() {
		return 3;
	}

	public get gridHeight() {
		return Math.max(this.numInputs, this.numOutputs);
	}

	public get rotationMatrix(): Matrix {
		// TODO: use this.getBounds() or implement own method?
		const bounds = this.getBounds();
		const centerX = bounds.x + bounds.width / 2;
		const centerY = bounds.y + bounds.height / 2;

		return Matrix.IDENTITY.translate(-centerX, -centerY)
			.rotate((this._rotation * Math.PI) / 2)
			.translate(centerX, centerY);
	}

	private rotatePoint(point: Point): Point {
		return this.rotationMatrix.apply(point);
	}

	public get inputConnections(): Point[] {
		const inputs = [];
		for (let i = 0; i < this.numInputs; i++) {
			inputs.push(this.rotatePoint(new Point(0, 0.5 + i)));
		}

		return inputs;
	}

	protected fromGrid(point: Point): Point {
		return point.set(
			point.x * environment.gridPixelWidth,
			point.y * environment.gridPixelWidth
		);
	}

	protected draw(): void {
		this.removeChildren(0);
		this.clear();

		this.drawInputs();

		this.addChild(this._inputsGraphics);
	}

	private drawInputs(): void {
		this._inputsGraphics.removeChildren(0);

		for (const connection of this.inputConnections) {
			const child = new ScalingGraphics(wireGeometry());
			console.log(connection);
			child.position = this.fromGrid(connection);
			child.scale.set(environment.gridPixelWidth, 0.5);
			child.constantScaleY = true;
			this._inputsGraphics.addChild(child);
		}
	}
}
