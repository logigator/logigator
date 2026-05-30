import {
	Text,
	Container,
	DestroyOptions,
	Graphics,
	Matrix,
	Point,
	Rectangle
} from 'pixi.js';
import { Subject } from 'rxjs';
import { ComponentConfig, ComponentConfigView } from './component-config.model';
import { ThemingService } from '../theming/theming.service';
import { getStaticDI } from '../utils/get-di';
import { GraphicsProviderService } from '../rendering/graphics-provider.service';
import { environment } from '../../environments/environment';
import { PX } from '../utils/grid';
import { WireGraphics } from '../rendering/graphics/wire.graphics';
import { ComponentOption } from './component-option';
import { SerializedComponent } from './serialized-component.model';
import { Connectable } from '../rendering/grid-element';
import { IdAllocator } from '../utils/id-allocator';
import { Direction } from '../utils/direction';

export interface PortsChange {
	oldPorts: Point[];
	newPorts: Point[];
}

export abstract class Component<
	TOptions extends Record<string, ComponentOption> = Record<string, ComponentOption>
> extends Container implements Connectable {
	private static readonly _idAllocator = new IdAllocator();
	public abstract readonly config: ComponentConfigView<TOptions>;
	public readonly ignoresWireCollision: boolean = false;
	public readonly options: TOptions;

	// Fires when port positions change (rotation, input/output count). The listener
	// (typically Project) is responsible for refreshing derived state such as
	// connection-point markers. Not fired during construction.
	public readonly portsChange$ = new Subject<PortsChange>();

	protected readonly themingService: ThemingService =
		getStaticDI(ThemingService);
	protected readonly geometryService: GraphicsProviderService = getStaticDI(
		GraphicsProviderService
	);

	private _id: number;

	private _direction: Direction = Direction.E;
	private _appliedScale = 1;

	private _numInputs = 0;
	private _numOutputs = 0;

	private _rotationCounterContainers: Container[] = [];

	private _initialized = false;

	public static serialize(component: Component): SerializedComponent {
		return {
			id: component.id,
			type: component.config.type,
			pos: [component.position.x, component.position.y],
			options: Object.fromEntries(
				Object.entries(component.options).map(([key, opt]) => [key, opt.value])
			)
		};
	}

	public static deserialize(
		// `id` is optional: if not specified, a fresh id is
		// allocated by the constructor.
		serialized: Omit<SerializedComponent, 'id' | 'type'> & { id?: number },
		config: ComponentConfig
	): Component {
		const options = Object.fromEntries(
			Object.entries(config.options).map(([key, proto]) => [
				key,
				proto.clone(serialized.options[key])
			])
		);
		const component = new config.implementation(options);
		if (serialized.id !== undefined) {
			component.id = serialized.id;
		}
		component.position.set(serialized.pos[0], serialized.pos[1]);

		return component;
	}

	protected constructor(
		numInputs: number,
		numOutputs: number,
		direction: Direction,
		options: Record<string, ComponentOption>
	) {
		super();

		this.interactiveChildren = false;
		this._id = Component._idAllocator.next();

		this.numInputs = numInputs;
		this.numOutputs = numOutputs;
		this.direction = direction;
		this.options = options as TOptions;

		this._initialized = true;

		this._draw();
	}

	protected abstract get inputLabels(): string[];

	protected abstract get outputLabels(): string[];

	protected abstract get bodyGridWidth(): number;

	protected abstract draw(): void;

	public get id(): number {
		return this._id;
	}

	public set id(value: number) {
		Component._idAllocator.bump(value);
		this._id = value;
	}

	public get direction(): Direction {
		return this._direction;
	}

	public set direction(value: Direction) {
		const oldPorts = this._initialized ? this.connectionPoints : null;
		this._direction = value;

		this.rotation = (value * Math.PI) / 2;

		for (const container of this._rotationCounterContainers) {
			container.rotation = -this.rotation;
		}

		if (environment.debug.showConnectionPoints) {
			this._draw();
		}

		if (oldPorts) {
			this.portsChange$.next({ oldPorts, newPorts: this.connectionPoints });
		}
	}

	public get numInputs(): number {
		return this._numInputs;
	}

	public set numInputs(value: number) {
		const oldPorts = this._initialized ? this.connectionPoints : null;
		this._numInputs = value;
		this._draw();
		if (oldPorts) {
			this.portsChange$.next({ oldPorts, newPorts: this.connectionPoints });
		}
	}

	public get numOutputs(): number {
		return this._numOutputs;
	}

	public set numOutputs(value: number) {
		const oldPorts = this._initialized ? this.connectionPoints : null;
		this._numOutputs = value;
		this._draw();
		if (oldPorts) {
			this.portsChange$.next({ oldPorts, newPorts: this.connectionPoints });
		}
	}

	public get appliedScale(): number {
		return this._appliedScale;
	}

	public applyScale(scale: number): void {
		this._appliedScale = scale;
		this._draw();
	}

	public override destroy(options?: DestroyOptions): void {
		this.portsChange$.complete();
		super.destroy(options);
	}

	public get connectionPoints(): Point[] {
		return this._localConnectionPoints.map(
			(p) => new Point(this.position.x + p.x, this.position.y + p.y)
		);
	}

	protected get bodyGridHeight(): number {
		return Math.max(this.numInputs, this.numOutputs);
	}

	public get bodyGridBounds(): Rectangle {
		return this._rotatedBounds(0, this.bodyGridWidth, this.bodyGridHeight);
	}

	public get gridBounds(): Rectangle {
		// Stub offsets in the component's unrotated local frame.
		// ly is always 0 — stubs are horizontal and don't extend the y extent.
		const lx = this.numInputs > 0 ? -0.5 : 0;
		const w =
			this.bodyGridWidth +
			(this.numInputs > 0 ? 0.5 : 0) +
			(this.numOutputs > 0 ? 0.5 : 0);
		return this._rotatedBounds(lx, w, this.bodyGridHeight);
	}

	// AABB in parent (gridSpace) coordinates for a rectangle of size (w × h) with
	// an optional unrotated x-offset (lx), accounting for component rotation.
	private _rotatedBounds(lx: number, w: number, h: number): Rectangle {
		const x = this.position.x;
		const y = this.position.y;

		switch (this._direction) {
			case Direction.E:
				return new Rectangle(x + lx, y, w, h);
			case Direction.S:
				return new Rectangle(x - h, y + lx, h, w);
			case Direction.W:
				return new Rectangle(x - lx - w, y - h, w, h);
			case Direction.N:
				return new Rectangle(x, y - lx - w, h, w);
		}
	}

	protected registerRotationCounterContainer(container: Container): Container {
		container.rotation = -this.rotation;
		this._rotationCounterContainers.push(container);
		return container;
	}

	private get _localConnectionPoints(): Point[] {
		const matrix = Matrix.IDENTITY.rotate(this.rotation);

		const bounds = this.getLocalBounds();
		const points: Point[] = [];

		for (let i = 0; i < this.numInputs; i++) {
			points.push(matrix.apply(new Point(-0.5, i + 0.5)));
		}
		for (let i = 0; i < this.numOutputs; i++) {
			points.push(matrix.apply(new Point(bounds.right, i + 0.5)));
		}

		return points;
	}

	protected redraw(): void {
		this._draw();
	}

	private _draw(): void {
		if (!this._initialized) {
			return;
		}

		// destroy() calls removeFromParent which mutates `children` during
		// iteration — snapshot before iterating so every child gets destroyed.
		for (const child of [...this.children]) {
			child.destroy({ children: true });
		}
		this.removeChildren(0);

		this._rotationCounterContainers = [];

		this.draw();

		this._drawConnections(this._numInputs, 'inputs');
		this._drawConnections(this._numOutputs, 'outputs');

		if (environment.debug.showConnectionPoints) {
			const connPoints = new Graphics();

			for (const point of this._localConnectionPoints) {
				connPoints.rect(point.x - PX, point.y - PX, 2 * PX, 2 * PX);
			}
			connPoints.fill(0xffff00);

			this.addChild(connPoints);
			this.registerRotationCounterContainer(connPoints);
		}

		if (environment.debug.showOrigins) {
			const originGraphics = new Graphics();
			originGraphics.rect(0, 0, 2 * PX, 2 * PX);
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
			wire.position.set(0, i + 0.5);
			wire.scale.set(0.5, PX / this._appliedScale);
			container.addChild(wire);

			if (labels.length > i) {
				const text = new Text({
					text: labels[i],
					style: {
						fontFamily: 'Roboto',
						fontSize: 0.5 / PX,
						fill: this.themingService.currentTheme().fontTint
					},
					anchor: { x: type === 'inputs' ? 0 : 1, y: 0.5 },
					resolution: this._appliedScale * window.devicePixelRatio
				});

				// naturalWidth is the pixel width before scale is applied.
				// Pivot placed at the texture center so that the rotation counter
				// (applied by registerRotationCounterContainer) rotates around the
				// center, keeping the label anchored to the same grid point in all
				// component directions.
				const naturalWidth = text.width;
				text.scale.set(PX);
				text.pivot.set((naturalWidth / 2) * (type === 'inputs' ? 1 : -1), 0);

				if (type === 'inputs') {
					text.position.set(0.5 + (naturalWidth * PX) / 2 + 2 * PX, i + 0.5);
				} else {
					text.position.set((-naturalWidth * PX) / 2 - 2 * PX, i + 0.5);
				}

				this.registerRotationCounterContainer(text);
				container.addChild(text);
			}
		}

		// For outputs: use bodyGridWidth (path right edge) not getLocalBounds().right,
		// which includes the stroke's miter extension and would place stubs ~sqrt(2)*PX
		// too far right — causing valid touching connections to falsely collide.
		if (type === 'outputs') {
			container.position.x = this.bodyGridWidth;
		} else {
			container.position.x = -0.5;
		}

		this.addChild(container);
	}
}
