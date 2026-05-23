import { Graphics, Point, Rectangle } from 'pixi.js';
import { WireDirection } from './wire-direction.enum';
import { getStaticDI } from '../utils/get-di';
import { GraphicsProviderService } from '../rendering/graphics-provider.service';
import { WireGraphics } from '../rendering/graphics/wire.graphics';
import { environment } from '../../environments/environment';
import { SerializedWire } from './serialized-wire.model';
import { WireSnapshot } from './wire-snapshot.model';
import { Connectable } from '../rendering/grid-element';
import { IdAllocator } from '../utils/id-allocator';

export class Wire extends Graphics implements Connectable {
	private static readonly _idAllocator = new IdAllocator();
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
		// Serialized coordinates are integer grid positions; the +0.5 half-grid
		// offset is the convention for wire centre-line alignment and is added
		// at load time rather than stored on disk.
		wire.position.set(serialized.pos[0] + 0.5, serialized.pos[1] + 0.5);

		return wire;
	}

	public static snapshot(wire: Wire): WireSnapshot {
		const [start, end] = wire.connectionPoints;
		return {
			start,
			end,
			direction: wire.direction,
			gridBounds: wire.gridBounds
		};
	}

	public static segmentContains(
		start: Point,
		end: Point,
		direction: WireDirection,
		p: Point
	): boolean {
		if (direction === WireDirection.HORIZONTAL) {
			return p.y === start.y && p.x >= start.x && p.x <= end.x;
		}
		return p.x === start.x && p.y >= start.y && p.y <= end.y;
	}

	constructor(direction: WireDirection, gridLength?: number) {
		super();

		this.interactiveChildren = false;
		this.context =
			this.graphicsProviderService.getGraphicsContext(WireGraphics);

		this._id = Wire._idAllocator.next();

		this.direction = direction;

		if (gridLength) {
			this.length = gridLength;
		}
	}

	public get id(): number {
		return this._id;
	}

	public set id(value: number) {
		Wire._idAllocator.bump(value);
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

	public contains(p: Point): boolean {
		if (this.direction === WireDirection.HORIZONTAL) {
			return (
				p.y === this.position.y &&
				p.x >= this.position.x &&
				p.x <= this.position.x + this.length
			);
		}
		return (
			p.x === this.position.x &&
			p.y >= this.position.y &&
			p.y <= this.position.y + this.length
		);
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
