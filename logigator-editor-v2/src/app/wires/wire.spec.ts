import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { makeWire } from '../../testing/factories';
import { GraphicsProviderService } from '../rendering/graphics-provider.service';
import {
  POWERED_WIRE_PIVOT,
  POWERED_WIRE_THICKNESS,
  WireGraphics
} from '../rendering/graphics/wire.graphics';
import { WireDirection } from './wire-direction.enum';
import { environment } from '../../environments/environment';

describe('Wire.setPowered', () => {
  let provider: GraphicsProviderService;

  beforeEach(() => {
    configureTestBed();
    provider = TestBed.inject(GraphicsProviderService);
  });

  it('thickens via a centred transform, keeping the shared context', () => {
    const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 4);
    const context = wire.context;
    expect(context).toBe(provider.getGraphicsContext(WireGraphics));
    const baseScaleY = wire.scale.y;

    // The per-frame hot path: powered state must land as transform only — a
    // context swap or redraw would force a render-group instruction rebuild.
    wire.setPowered(true);
    expect(wire.context).toBe(context);
    expect(wire.scale.y).toBeCloseTo(baseScaleY * POWERED_WIRE_THICKNESS, 8);
    expect(wire.pivot.y).toBeCloseTo(POWERED_WIRE_PIVOT, 8);

    wire.setPowered(false);
    expect(wire.context).toBe(context);
    expect(wire.scale.y).toBeCloseTo(baseScaleY, 8);
    expect(wire.pivot.y).toBe(0);

    wire.destroy();
  });

  it('keeps powered thickness across zoom, and zoom across power flips', () => {
    const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 4);
    const zoomed = 1 / (2 * environment.gridSize);

    wire.setPowered(true);
    wire.applyScale(2);
    expect(wire.scale.y).toBeCloseTo(zoomed * POWERED_WIRE_THICKNESS, 8);
    expect(wire.pivot.y).toBeCloseTo(POWERED_WIRE_PIVOT, 8);

    wire.setPowered(false);
    expect(wire.scale.y).toBeCloseTo(zoomed, 8);
    expect(wire.pivot.y).toBe(0);

    wire.destroy();
  });

  it('does not disturb the length axis', () => {
    const wire = makeWire(0, 0, WireDirection.VERTICAL, 5);

    wire.setPowered(true);
    expect(wire.length).toBe(5);

    wire.destroy();
  });
});
