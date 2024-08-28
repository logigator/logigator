import { Graphics, Point } from 'pixi.js';
import { WireDirection } from './wire-direction.enum';
import { getStaticDI } from '../utils/get-di';
import { GraphicsProviderService } from '../rendering/graphics-provider.service';
import { WireGraphics } from '../rendering/graphics/wire.graphics';
import { fromGrid, toGrid, toHalfGridPoint } from '../utils/grid';
import { SerializedWire } from './serialized-wire.model';

let WIRE_ID_COUNTER = 0;

export class Wire extends Graphics {
	private readonly graphicsProviderService = getStaticDI(
		GraphicsProviderService
	);

	private _id: number;

	public static serialize(wire: Wire): SerializedWire {
		return {
			id: wire.id,
			pos: [Math.floor(wire.gridPos.x), Math.floor(wire.gridPos.y)],
			direction: wire.direction,
			length: wire.gridLength
		};
	}

	public static deserialize(serialized: SerializedWire): Wire {
		const wire = new Wire(serialized.direction, serialized.length);
		wire.id = serialized.id;
		wire.gridPos = new Point(serialized.pos[0] + 0.5, serialized.pos[1] + 0.5);

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
			this.gridLength = gridLength;
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

	public get gridPos(): Point {
		return toHalfGridPoint(this.position);
	}

	public set gridPos(value: Point) {
		this.position.set(fromGrid(value.x), fromGrid(value.y));
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

	public get gridLength(): number {
		return toGrid(this.scale.x);
	}

	public set gridLength(value: number) {
		this.scale.x = fromGrid(value);
	}

	public applyScale(scale: number): void {
		this.scale.y = 1 / scale;
	}

	public get connectionPoints(): [Point, Point] {
		const gridPos = this.gridPos;

		return [
			gridPos,
			this.rotation === 0
				? new Point(gridPos.x + this.gridLength, gridPos.y)
				: new Point(gridPos.x, gridPos.y + this.gridLength)
		];
	}
}
