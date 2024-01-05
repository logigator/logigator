import {
	BitmapText,
	Graphics,
	Point
} from 'pixi.js';

import { ElementType } from '../../models/element/element-type';
import { ElementCategory } from '../../models/element/element-category';
import { ComponentOption } from '../component-option/component-option';
import { ElementRotation } from '../../models/element-rotation';
import { ThemingService } from '../../services/theming/theming.service';
import { GeometryService } from '../../services/geometry/geometry.service';
import { getStaticDI } from '../../utils/get-di';
import { WireGraphics } from './graphics/wire.graphics';
import { fromGrid, toGrid } from '../../utils/grid';

export interface ComponentConfig {
	type: ElementType;
	name: string;
	symbol: string;
	symbolImage?: string;
	description: string;
	category: ElementCategory;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	options: ComponentOption<any>[];
	generate: (options: ComponentOption<unknown>[]) => Component;
}

export class ScalingGraphics extends Graphics {
	public constantScaleX = false;
	public constantScaleY = false;
	public constantRotation = false;
	public constantScaleChildren = false;

	public applyConstantScale(scale: number) {
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

	public applyConstantRotation(rotation: number) {
		if (this.constantRotation) {
			this.rotation = -rotation;
		}
		if (this.constantScaleChildren) {
			for (const child of this.children) {
				if (child instanceof ScalingGraphics) {
					child.applyConstantRotation(rotation);
				}
			}
		}
	}
}

export abstract class Component extends ScalingGraphics {
	override sortableChildren = false;
	override constantScaleChildren = true;

	public abstract readonly config: ComponentConfig;
	public readonly options: ComponentOption<unknown>[];

	protected readonly themingService: ThemingService =
		getStaticDI(ThemingService);
	protected readonly geometryService: GeometryService =
		getStaticDI(GeometryService);

	private _direction: ElementRotation;

	private _numInputs: number;
	private _numOutputs: number;

	private _inputsGraphics: ScalingGraphics = new ScalingGraphics();
	private _outputsGraphics: ScalingGraphics = new ScalingGraphics();

	protected constructor(
		numInputs: number,
		numOutputs: number,
		direction: ElementRotation,
		options: ComponentOption<unknown>[]
	) {
		super();

		this._numInputs = numInputs;
		this._numOutputs = numOutputs;
		this._direction = direction;
		this._inputsGraphics.constantScaleChildren = true;
		this._outputsGraphics.constantScaleChildren = true;

		this.options = options;
		this.options[0].value;

		this._draw();
	}

	protected abstract get inputLabels(): string[];
	protected abstract get outputLabels(): string[];

	public get gridPos(): Point {
		return new Point(
			toGrid(this.position.x - this.pivot.x),
			toGrid(this.position.y - this.pivot.y)
		);
	}

	public set gridPos(value: Point) {
		this.position.set(
			fromGrid(value.x) + this.pivot.x,
			fromGrid(value.y) + this.pivot.y
		);
	}

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

	public get direction(): ElementRotation {
		return this._direction;
	}

	public set direction(value: ElementRotation) {
		this._direction = value;
		this.rotation = (value * Math.PI) / 2;
		this.applyConstantRotation((value * Math.PI) / 2);
	}

	private _draw(): void {
		this.removeChildren(0);
		this.clear();

		this.draw();

		this.drawConnections(
			this._numInputs,
			'inputs'
		);
		this.drawConnections(
			this._numOutputs,
			'outputs'
		);
		this._outputsGraphics.position.set(this.width + fromGrid(0.5), 0);
		this.addChild(this._inputsGraphics);
		this.addChild(this._outputsGraphics);

		this.pivot.set(this.width / 2, this.height / 2);
		this.direction = this._direction;
	}

	protected abstract draw(): void;

	private drawConnections(
		n: number,
		type: 'inputs' | 'outputs'
	): void {
		const geometry = this.geometryService.getGeometry(WireGraphics);
		const container =
			type === 'inputs' ? this._inputsGraphics : this._outputsGraphics;
		const labels = type === 'inputs' ? this.inputLabels : this.outputLabels;
		container.removeChildren(0);

		for (let i = 0; i < n; i++) {
			const wire = new ScalingGraphics(geometry);
			wire.position.set(0, fromGrid(i + 0.5));
			wire.scale.set(fromGrid(0.5), 1);
			wire.constantScaleY = true;
			container.addChild(wire);

			if (labels.length > i) {
				const text = new BitmapText(labels[i], {
					fontName: 'Roboto',
					fontSize: fromGrid(0.5),
					tint: this.themingService.getEditorColor('fontTint')
				});
				text.anchor.set(type === 'inputs' ? 0 : 1, 0.5);

				const child = new ScalingGraphics();
				child.addChild(text);
				child.pivot.set((child.width / 2) * (type === 'inputs' ? 1 : -1), 0);
				if (type === 'inputs') {
					child.position.set(
						fromGrid(0.5) + child.width / 2 + 2,
						fromGrid(i + 0.5)
					);
				} else {
					child.position.set(-child.width / 2 - 2, fromGrid(i + 0.5));
				}

				child.constantRotation = true;

				container.addChild(child);
			}
		}
	}
}
