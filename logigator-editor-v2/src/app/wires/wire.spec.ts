import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { makeWire } from '../../testing/factories';
import { GraphicsProviderService } from '../rendering/graphics-provider.service';
import {
  POWERED_WIRE_THICKNESS,
  WireGraphics
} from '../rendering/graphics/wire.graphics';
import { WireDirection } from './wire-direction.enum';

describe('Wire.setPowered', () => {
  let provider: GraphicsProviderService;

  beforeEach(() => {
    configureTestBed();
    provider = TestBed.inject(GraphicsProviderService);
  });

  it('swaps to the shared powered context and back', () => {
    const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 4);
    const unpowered = wire.context;
    expect(unpowered).toBe(provider.getGraphicsContext(WireGraphics));

    wire.setPowered(true);
    expect(wire.context).toBe(
      provider.getGraphicsContext(WireGraphics, POWERED_WIRE_THICKNESS)
    );
    expect(wire.context).not.toBe(unpowered);

    wire.setPowered(false);
    expect(wire.context).toBe(unpowered);

    wire.destroy();
  });

  it('shares one powered context across all wires', () => {
    const a = makeWire(0, 0, WireDirection.HORIZONTAL, 4);
    const b = makeWire(0, 4, WireDirection.VERTICAL, 2);

    a.setPowered(true);
    b.setPowered(true);
    expect(a.context).toBe(b.context);

    a.destroy();
    b.destroy();
  });
});
