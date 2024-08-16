import { Container, Graphics, Matrix, Point } from 'pixi.js';
import { ComponentConfig } from './component-config.model';
import { ThemingService } from '../theming/theming.service';
import { getStaticDI } from '../utils/get-di';
import { GraphicsProviderService } from '../rendering/graphics-provider.service';
import { environment } from '../../environments/environment';
import { fromGrid, toGridPoint } from '../utils/grid';
import { ComponentOption } from './component-option';
import { ComponentRotation } from './component-rotation.enum';
import { WireGraphics } from '../rendering/graphics/wire.graphics';

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
	protected readonly geometryService: GraphicsProviderService = getStaticDI(
		GraphicsProviderService
	);

	private _direction: ComponentRotation;

	private _numInputs: number;
	private _numOutputs: number;

	private _constantScaleContainers: [ScaleType, Container][] = [];
	private _constantRotationContainers: Container[] = [];

	protected constructor(
		numInputs: number,
		numOutputs: number,
		direction: ComponentRotation,
		options: ComponentOption<unknown>[]
	) {
		super();

		this._numInputs = numInputs;
		this._numOutputs = numOutputs;
		this._direction = direction;
		this.options = options;

		this._draw();
	}

	protected abstract get inputLabels(): string[];

	protected abstract get outputLabels(): string[];

	protected abstract draw(): void;

	public get gridPos(): Point {
		return toGridPoint(this.position);
	}

	public set gridPos(value: Point) {
		this.position.set(fromGrid(value.x), fromGrid(value.y));
	}

	public get direction(): ComponentRotation {
		return this._direction;
	}

	public set direction(value: ComponentRotation) {
		this._direction = value;

		this.rotation = (value * Math.PI) / 2;

		for (const container of this._constantRotationContainers) {
			container.rotation = -this.rotation;
		}

		if (environment.debug.showConnectionPoints) {
			this._draw();
		}
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

	public get connectionPoints(): Point[] {
		return this._localConnectionPoints.map((x, i) =>
			toGridPoint(this.toGlobal(x, x, i !== 0))
		);
	}

	protected get center(): Point {
		let subtract = 0;
		if (this.numInputs > 0) {
			subtract += 0.5;
		}
		if (this.numOutputs > 0) {
			subtract += 0.5;
		}

		return new Point((this.width - fromGrid(subtract)) / 2, this.height / 2);
	}

	protected registerConstantScaleContainer(
		container: Container,
		type: ScaleType
	): Container {
		this._constantScaleContainers.push([type, container]);
		return container;
	}

	protected registerConstantRotationContainer(container: Container): Container {
		container.rotation = -this.rotation;
		this._constantRotationContainers.push(container);
		return container;
	}

	private get _localConnectionPoints(): Point[] {
		const matrix = Matrix.IDENTITY.rotate(this.rotation);

		const bounds = this.getLocalBounds();
		const points: Point[] = [];

		for (let i = 0; i < this.numInputs; i++) {
			points.push(matrix.apply(new Point(fromGrid(-0.5), fromGrid(i + 0.5))));
		}
		for (let i = 0; i < this.numOutputs; i++) {
			points.push(matrix.apply(new Point(bounds.right, fromGrid(i + 0.5))));
		}

		return points;
	}

	private _draw(): void {
		for (const child of this.children) {
			child.destroy({ children: true });
		}
		this.removeChildren(0);

		this._constantScaleContainers = [];
		this._constantRotationContainers = [];

		this.draw();

		this._drawConnections(this._numInputs, 'inputs');
		this._drawConnections(this._numOutputs, 'outputs');

		if (environment.debug.showConnectionPoints) {
			const connPoints = new Graphics();

			for (const point of this._localConnectionPoints) {
				connPoints.rect(point.x - 1, point.y - 1, 2, 2);
			}
			connPoints.fill(0xffff00);

			this.addChild(connPoints);
			this.registerConstantRotationContainer(connPoints);
		}

		if (environment.debug.showOrigins) {
			const origin = this.toLocal(this.position);
			const originGraphics = new Graphics();
			originGraphics.rect(origin.x, origin.y, 2, 2);
			originGraphics.fill(0xffffff);
			this.addChild(originGraphics);
		}

		if (environment.debug.showHitboxes) {
			const bounds = this.getLocalBounds();
			const hitbox = new Graphics();
			hitbox.rect(bounds.x, bounds.y, bounds.width, bounds.height);
			hitbox.fill({
				color: 0xff0000,
				alpha: 0.1
			});
			this.addChild(hitbox);
		}
	}

	private _drawConnections(n: number, type: 'inputs' | 'outputs'): void {
		const geometry = this.geometryService.getGraphicsContext(WireGraphics);
		const container = new Container();
		const labels = type === 'inputs' ? this.inputLabels : this.outputLabels;

		for (let i = 0; i < n; i++) {
			const wire = new Graphics(geometry);
			wire.position.set(0, fromGrid(i + 0.5));
			wire.scale.set(fromGrid(0.5), 1);
			this.registerConstantScaleContainer(wire, ScaleType.Y);

			container.addChild(wire);

			/*
			if (labels.length > i) {
				const text = new BitmapText(labels[i], {
					fontName: 'Roboto',
					fontSize: fromGrid(0.5),
					tint: this.themingService.currentTheme().fontTint
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

				this.registerConstantRotationContainer(text);
				container.addChild(text);
			}
			*/
		}

		if (type === 'outputs') {
			container.position.x = this.getLocalBounds().right;
		} else {
			container.position.x = fromGrid(-0.5);
		}

		this.addChild(container);
	}
}
