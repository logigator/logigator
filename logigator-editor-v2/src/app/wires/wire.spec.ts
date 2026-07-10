import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
import { ThemingService } from '../theming/theming.service';
import { ThemeType } from '../theming/theme-type.enum';

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

describe('Wire tint', () => {
  let theming: ThemingService;
  let originalTheme: ThemeType;

  beforeEach(() => {
    configureTestBed();
    theming = TestBed.inject(ThemingService);
    originalTheme = theming.currentThemeType();
  });

  afterEach(() => {
    theming.setActiveThemeType(originalTheme);
  });

  // The shared context is a white base, so the tint IS the wire's color. The
  // selection color must be a distinct explicit color in EVERY theme — a
  // multiplicative dark tint would be invisible on light mode's black wires
  // (black × anything = black).
  it('derives base and selection color from the theme, distinct in both themes', () => {
    for (const type of [ThemeType.DARK, ThemeType.LIGHT]) {
      theming.setActiveThemeType(type);
      const theme = theming.currentTheme();
      const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 4);

      expect(wire.tint).toBe(theme.wire);

      wire.selected = true;
      expect(wire.tint).toBe(theme.wireSelectColor);
      expect(wire.tint).not.toBe(theme.wire);

      wire.destroy();
    }
  });

  it('refreshTint recolors a selected wire for the new theme without a context swap', () => {
    theming.setActiveThemeType(ThemeType.DARK);
    const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 4);
    const context = wire.context;
    wire.selected = true;

    theming.setActiveThemeType(ThemeType.LIGHT);
    wire.refreshTint();

    expect(wire.tint).toBe(theming.currentTheme().wireSelectColor);
    expect(wire.context).toBe(context);

    wire.destroy();
  });
});
