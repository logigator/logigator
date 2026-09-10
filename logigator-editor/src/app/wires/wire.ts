import { Graphics, Point, Rectangle } from 'pixi.js';
import { WireDirection } from '@logigator/core';
import { getStaticDI } from '../utils/get-di';
import { GraphicsProviderService } from '../rendering/graphics-provider.service';
import {
  POWERED_WIRE_PIVOT,
  POWERED_WIRE_THICKNESS,
  WireGraphics
} from '../rendering/graphics/wire.graphics';
import { environment } from '../../environments/environment';
import { ThemingService } from '../theming/theming.service';
import { SerializedWire } from './serialized-wire.model';
import { WireSnapshot } from './wire-snapshot.model';
import { Connectable } from '../rendering/grid-element';
import { IdAllocator } from '../utils/id-allocator';
import { overlapsRect } from '../utils/grid';

export class Wire extends Graphics implements Connectable {
  private static readonly _idAllocator = new IdAllocator();
  private readonly graphicsProviderService = getStaticDI(
    GraphicsProviderService
  );
  private readonly themingService = getStaticDI(ThemingService);

  private _id: number;

  // Combined by _applyThickness, kept apart so a zoom during simulation
  // preserves the powered thickness and vice versa.
  private _powered = false;
  private _baseScaleY = 1;
  private _selected = false;

  public static serialize(wire: Wire): SerializedWire {
    return {
      id: wire.id,
      pos: [Math.floor(wire.position.x), Math.floor(wire.position.y)],
      direction: wire.direction,
      length: wire.length
    };
  }

  public static deserialize(
    // Without an `id` the constructor allocates a fresh one.
    serialized: Omit<SerializedWire, 'id'> & { id?: number }
  ): Wire {
    const wire = new Wire(serialized.direction, serialized.length);
    if (serialized.id !== undefined) {
      wire.id = serialized.id;
    }
    // Stored as integer grid positions; the +0.5 centre-line offset is added
    // at load time rather than held on disk.
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

  public static split(w: Wire, at: Point): [Wire, Wire] {
    const [start, end] = w.connectionPoints;
    const w1 = new Wire(w.direction);
    const w2 = new Wire(w.direction);
    w1.position.set(start.x, start.y);
    w2.position.set(at.x, at.y);
    if (w.direction === WireDirection.HORIZONTAL) {
      w1.length = at.x - start.x;
      w2.length = end.x - at.x;
    } else {
      w1.length = at.y - start.y;
      w2.length = end.y - at.y;
    }
    return [w1, w2];
  }

  public static merge(a: Wire, b: Wire): Wire {
    const [s0, e0] = a.connectionPoints;
    const [s1, e1] = b.connectionPoints;
    if (a.direction === WireDirection.HORIZONTAL) {
      const minX = Math.min(s0.x, s1.x);
      const maxX = Math.max(e0.x, e1.x);
      const merged = new Wire(WireDirection.HORIZONTAL, maxX - minX);
      merged.position.set(minX, s0.y);
      return merged;
    } else {
      const minY = Math.min(s0.y, s1.y);
      const maxY = Math.max(e0.y, e1.y);
      const merged = new Wire(WireDirection.VERTICAL, maxY - minY);
      merged.position.set(s0.x, minY);
      return merged;
    }
  }

  constructor(direction: WireDirection, gridLength?: number) {
    super();

    this.context =
      this.graphicsProviderService.getGraphicsContext(WireGraphics);
    this.refreshTint();

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

  /**
   * Thickens the wire during simulation. A per-frame hot path, so it stays a
   * pure transform on the one shared context, which PixiJS patches into the
   * existing batch in place; a context swap here would be catastrophic.
   */
  public setPowered(powered: boolean): void {
    this._powered = powered;
    this._applyThickness();
  }

  /** Whether the wire carries the selection color. */
  public get selected(): boolean {
    return this._selected;
  }

  public set selected(value: boolean) {
    this._selected = value;
    this.refreshTint();
  }

  /**
   * Re-derives the tint from theme and selection state. The shared context is a
   * white base, so the tint *is* the wire's color: this is both the
   * theme-change hook and the way back from a transient tint (collision red).
   */
  public refreshTint(): void {
    const theme = this.themingService.currentTheme();
    this.tint = this._selected ? theme.wireSelectColor : theme.wire;
  }

  public applyScale(scale: number): void {
    // A leaf Graphics with no _visualSpace wrapper, so it absorbs the gridSize
    // factor here rather than through a counter-scaling child.
    this._baseScaleY = 1 / (scale * environment.gridSize);
    this._applyThickness();
  }

  private _applyThickness(): void {
    this.scale.y =
      this._baseScaleY * (this._powered ? POWERED_WIRE_THICKNESS : 1);
    this.pivot.y = this._powered ? POWERED_WIRE_PIVOT : 0;
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
    // Wires sit at half-grid positions, so flooring the origin and extending
    // the spanning side by 1 covers the half-grid padding at both ends: a wire
    // at (3.5, 4.5) of length 5 spans x ∈ [3.5, 8.5], inside [3, 9)×[4, 5).
    const x = Math.floor(this.position.x);
    const y = Math.floor(this.position.y);
    if (this.direction === WireDirection.HORIZONTAL) {
      return new Rectangle(x, y, this.length + 1, 1);
    }
    return new Rectangle(x, y, 1, this.length + 1);
  }

  /** Allocation-free mirror of {@link gridBounds} — the two must agree. */
  public intersectsGridBounds(rect: Rectangle): boolean {
    const pos = this.position;
    const x = Math.floor(pos.x);
    const y = Math.floor(pos.y);
    const span = this.length + 1;
    return this.direction === WireDirection.HORIZONTAL
      ? overlapsRect(rect, x, y, span, 1)
      : overlapsRect(rect, x, y, 1, span);
  }

  public get cullBounds(): Rectangle {
    return this.gridBounds;
  }
}
