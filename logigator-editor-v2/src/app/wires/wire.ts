import { Graphics, Point, Rectangle } from 'pixi.js';
import { WireDirection } from './wire-direction.enum';
import { getStaticDI } from '../utils/get-di';
import { GraphicsProviderService } from '../rendering/graphics-provider.service';
import { WireGraphics } from '../rendering/graphics/wire.graphics';
import { environment } from '../../environments/environment';
import { SerializedWire } from './serialized-wire.model';
import { GridElement } from '../rendering/grid-element';

let WIRE_ID_COUNTER = 0;

export class Wire extends Graphics implements GridElement {
	private readonly graphicsProviderService = getStaticDI(
		GraphicsProviderService
	);

	private _id: number;

	public static serialize(wire: Wire): SerializedWire {
		return {
			id: wire.id,
			pos: [Math.floor(wire.position.x), Math.floor(wire.position.y)],
			direction: wire.direction,
			length: wire.length
		};
	}

	public static deserialize(serialized: SerializedWire): Wire {
		const wire = new Wire(serialized.direction, serialized.length);
		wire.id = serialized.id;
		wire.position.set(serialized.pos[0] + 0.5, serialized.pos[1] + 0.5);

		return wire;
	}

	constructor(direction: WireDirection, gridLength?: number) {
		super();

		this.interactiveChildren = false;
		this.context =
			this.graphicsProviderService.getGraphicsContext(WireGraphics);

		this._id = WIRE_ID_COUNTER++;

		this.direction = direction;

		if (gridLength) {
			this.length = gridLength;
		}
	}

	public get id(): number {
		return this._id;
	}

	public set id(value: number) {
		if (value >= WIRE_ID_COUNTER) {
			WIRE_ID_COUNTER = value + 1;
		}
		this._id = value;
	}

	public get direction(): WireDirection {
		return this.rotation === 0
			? WireDirection.HORIZONTAL
			: WireDirection.VERTICAL;
	}

	public set direction(value: WireDirection) {
		this.rotation = value === WireDirection.HORIZONTAL ? 0 : Math.PI / 2;
	}

	public get length() {
		return this.scale.x;
	}

	public set length(value: number) {
		this.scale.x = value;
	}

	public applyScale(scale: number): void {
		// Wire is a leaf Graphics with no _visualSpace wrapper, so it absorbs the
		// gridSize factor here. Component takes care of this via its _visualSpace
		// counter-scaling instead.
		this.scale.y = 1 / (scale * environment.gridSize);
	}

	public get connectionPoints(): [Point, Point] {
		const pos = this.position.clone();

		return [
			pos,
			this.rotation === 0
				? new Point(pos.x + this.length, pos.y)
				: new Point(pos.x, pos.y + this.length)
		];
	}

	public get gridBounds(): Rectangle {
		// Wires sit at half-grid positions (e.g., x=3.5). Floor the origin and
		// extend the spanning side by 1 so the rect covers the full half-grid
		// padding on both ends. For a wire at (3.5, 4.5) of length 5, the visual
		// extent is x ∈ [3.5, 8.5], which the AABB [3, 9) × [4, 5) encloses.
		const x = Math.floor(this.position.x);
		const y = Math.floor(this.position.y);
		if (this.direction === WireDirection.HORIZONTAL) {
			return new Rectangle(x, y, this.length + 1, 1);
		}
		return new Rectangle(x, y, 1, this.length + 1);
	}
}
