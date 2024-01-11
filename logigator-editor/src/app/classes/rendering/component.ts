import { BitmapText, Container, Graphics, Point } from 'pixi.js';

import { ElementType } from '../../models/element/element-type';
import { ElementCategory } from '../../models/element/element-category';
import { ComponentOption } from '../component-option/component-option';
import { ElementRotation } from '../../models/element-rotation';
import { ThemingService } from '../../services/theming/theming.service';
import { GeometryService } from '../../services/geometry/geometry.service';
import { getStaticDI } from '../../utils/get-di';
import { WireGraphics } from './graphics/wire.graphics';
import { fromGrid } from '../../utils/grid';
import { environment } from '../../../environments/environment';

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

export const enum ScaleType {
	X = 1,
	Y = 2,
	XY = 3
}

export abstract class Component extends Container {
	override sortableChildren = false;

	public abstract readonly config: ComponentConfig;
	public readonly options: ComponentOption<unknown>[];

	protected readonly themingService: ThemingService =
		getStaticDI(ThemingService);
	protected readonly geometryService: GeometryService =
		getStaticDI(GeometryService);

	private _direction: ElementRotation;
	private _gridPos: Point = new Point();

	private _numInputs: number;
	private _numOutputs: number;

	private _constantScaleContainers: [ScaleType, Container][] = [];
	private _constantRotationContainers: Container[] = [];

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
		this.options = options;
		this.options[0].value;

		this._draw();
	}

	protected abstract get inputLabels(): string[];
	protected abstract get outputLabels(): string[];

	protected get gridHeight(): number {
		return Math.max(this.numInputs, this.numOutputs);
	}

	protected get gridWidth(): number {
		return 4;
	}

	public get gridPos(): Point {
		return this._gridPos;
	}

	public set gridPos(value: Point) {
		this._gridPos.copyFrom(value);
		this.position.set(
			fromGrid(value.x),
			fromGrid(value.y)
		);
	}

	public get numInputs(): number {
		return this._numInputs;
	}

	public set numInputs(value: number) {
		this._numInputs = value;
		this._draw();
	}

	public get numOutputs(): number {
		return this._numOutputs;
	}

	public set numOutputs(value: number) {
		this._numOutputs = value;
		this._draw();
	}

	public get direction(): ElementRotation {
		return this._direction;
	}

	public set direction(value: ElementRotation) {
		this._direction = value;

		switch (value) {
			case ElementRotation.Down:
				this.pivot.set(0, this.height);
				break;
			case ElementRotation.Left:
				this.pivot.set(this.width, this.height);
				break;
			case ElementRotation.Up:
				this.pivot.set(this.width, 0);
				break;
			default:
				this.pivot.set(0, 0);
		}

		this.rotation = (value * Math.PI) / 2;

		for (const container of this._constantRotationContainers) {
			container.rotation = -this.rotation;
		}
	}

	public applyScale(scale: number): void {
		for (const [type, container] of this._constantScaleContainers) {
			if (type & 1) {
				container.scale.x = 1 / scale;
			}
			if (type & 2) {
				container.scale.y = 1 / scale;
			}
		}
	}

	protected constantScaleContainer(
		container: Container,
		type: ScaleType
	): Container {
		this._constantScaleContainers.push([type, container]);
		return container;
	}

	protected constantRotationContainer(container: Container): Container {
		this._constantRotationContainers.push(container);
		return container;
	}

	private _draw(): void {
		for (const child of this.children) {
			child.destroy({ children: true });
		}
		this.removeChildren(0);

		this._constantScaleContainers = [];
		this._constantRotationContainers = [];

		this.draw();

		this.drawConnections(this._numInputs, 'inputs');
		this.drawConnections(this._numOutputs, 'outputs');

		this.direction = this._direction;

		if (environment.debug.showHitboxes) {
			const hitbox = new Graphics();
			hitbox.beginFill(0xff0000, 0.1);
			hitbox.drawRect(0, 0, this.width, this.height);
			hitbox.endFill();
			this.addChild(hitbox);
		}
	}

	protected abstract draw(): void;

	private drawConnections(n: number, type: 'inputs' | 'outputs'): void {
		const geometry = this.geometryService.getGeometry(WireGraphics);
		const container = new Container();
		const labels = type === 'inputs' ? this.inputLabels : this.outputLabels;

		for (let i = 0; i < n; i++) {
			const wire = new Graphics(geometry);
			wire.position.set(0, fromGrid(i + 0.5));
			wire.scale.set(fromGrid(0.5), 1);
			this.constantScaleContainer(wire, ScaleType.Y);

			container.addChild(wire);

			if (labels.length > i) {
				const text = new BitmapText(labels[i], {
					fontName: 'Roboto',
					fontSize: fromGrid(0.5),
					tint: this.themingService.getEditorColor('fontTint')
				});
				text.anchor.set(type === 'inputs' ? 0 : 1, 0.5);
				text.pivot.set((text.width / 2) * (type === 'inputs' ? 1 : -1), 0);

				if (type === 'inputs') {
					text.position.set(
						fromGrid(0.5) + text.width / 2 + 2,
						fromGrid(i + 0.5)
					);
				} else {
					text.position.set(-text.width / 2 - 2, fromGrid(i + 0.5));
				}

				this.constantRotationContainer(text);
				container.addChild(text);
			}
		}

		if (type === 'outputs') {
			container.position.set(fromGrid(this.gridWidth - 0.5), 0);
		}

		this.addChild(container);
	}
}
