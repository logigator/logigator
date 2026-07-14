import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Graphics, Point } from 'pixi.js';
import { configureTestBed } from '../../testing/configure-test-bed';
import { scaleForScale as cpScaleForScale } from '../connection-points/connection-point';
import { ThemingService } from '../theming/theming.service';
import { FloatingLayer } from './floating-layer';

describe('FloatingLayer wire-tool ghosts', () => {
  let layer: FloatingLayer;

  beforeEach(() => {
    configureTestBed();
    layer = new FloatingLayer();
  });

  afterEach(() => {
    layer.destroy({ children: true });
  });

  /** The most recently created ghost Graphics (the dragLayer sits at index 0). */
  function lastGhost(): Graphics {
    return layer.children[layer.children.length - 1] as Graphics;
  }

  it('sizes the connection ghost for the zoom reached while it was hidden', () => {
    layer.showConnectionGhost(new Point(1, 1), 'split');
    const ghost = lastGhost();
    expect(ghost.width).toBeCloseTo(cpScaleForScale(1));

    layer.hideConnectionGhost();
    layer.updateScale(4);
    layer.showConnectionGhost(new Point(1, 1), 'split');

    expect(ghost.width).toBeCloseTo(cpScaleForScale(4));
  });

  it('styles the negation ghost per intent: translucent add, opaque invalid remove', () => {
    layer.showNegationGhost(new Point(1, 1), 'in', 0, false);
    const ghost = lastGhost();
    expect(ghost.alpha).toBe(0.5);
    expect(ghost.tint).toBe(0xffffff);

    layer.showNegationGhost(new Point(1, 1), 'in', 0, true);
    expect(ghost.alpha).toBe(1);
    expect(ghost.tint).toBe(
      TestBed.inject(ThemingService).currentTheme().invalid
    );
  });
});
