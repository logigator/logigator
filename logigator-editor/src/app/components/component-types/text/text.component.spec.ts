import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { Component } from '../../component';
import { Project } from '../../../project/project';
import { QuadTreeContainer } from '../../../rendering/quad-tree-container';
import { Direction } from '@logigator/core';
import { textComponentConfig } from './text.config';

function makeText(
  text: string,
  direction = Direction.E,
  fontSize = 12,
  pos: [number, number] = [0, 0]
): Component {
  return Component.deserialize(
    {
      pos,
      ...(direction !== Direction.E ? { direction } : {}),
      options: { fontSize, text }
    },
    textComponentConfig
  );
}

describe('TextComponent cull bounds', () => {
  beforeEach(() => {
    configureTestBed();
  });

  it('keeps gridBounds a 1×1 cell so selection and collision stay tight', () => {
    const comp = makeText('a very long label that runs off to the right');
    const g = comp.gridBounds;

    expect(g.width).toBe(1);
    expect(g.height).toBe(1);

    comp.destroy({ children: true });
  });

  it('widens cullBounds to cover the rendered glyph run beyond the anchor cell', () => {
    // 100 glyphs at 12px (0.6 em advance, 16px grid) ≈ 45 grid units wide.
    const comp = makeText('x'.repeat(100));
    const cull = comp.cullBounds;

    // The tail sits far right of the 1×1 anchor cell, so the cull box must
    // reach it to keep the label rendered once the anchor cell pans off the
    // left viewport edge.
    expect(cull.x).toBe(0);
    expect(cull.width).toBeGreaterThan(40);
    expect(cull.contains(40, 0.5)).toBe(true);

    comp.destroy({ children: true });
  });

  it('grows cullBounds with the text length', () => {
    const short = makeText('short');
    const long = makeText('short'.repeat(20));

    expect(long.cullBounds.width).toBeGreaterThan(short.cullBounds.width);

    short.destroy({ children: true });
    long.destroy({ children: true });
  });

  it('mirrors the cull box to the left of the anchor for W-direction text', () => {
    const text = 'x'.repeat(100);
    const east = makeText(text, Direction.E);
    const west = makeText(text, Direction.W);

    // Same string, so the box is the same width — just reflected: E extends
    // right of the anchor, W extends left of it.
    expect(west.cullBounds.width).toBe(east.cullBounds.width);
    expect(west.cullBounds.x).toBeLessThan(west.gridBounds.x);
    expect(east.cullBounds.x).toBeGreaterThanOrEqual(east.gridBounds.x);

    east.destroy({ children: true });
    west.destroy({ children: true });
  });

  it('grows cullBounds height for multi-line text', () => {
    // At 12px a single line fits inside one grid cell; six lines do not.
    const single = makeText('one line', Direction.E, 12);
    const multi = makeText('l1\nl2\nl3\nl4\nl5\nl6', Direction.E, 12);

    expect(single.cullBounds.height).toBe(1);
    expect(multi.cullBounds.height).toBeGreaterThan(single.cullBounds.height);

    single.destroy({ children: true });
    multi.destroy({ children: true });
  });
});

describe('TextComponent re-files on edit', () => {
  let project: Project;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  function quadTreeOf(p: Project): QuadTreeContainer<Component> {
    return (p as unknown as { _components: QuadTreeContainer<Component> })
      ._components;
  }

  it('re-inserts into the quad tree when the text grows so cull bounds are re-filed', () => {
    const comp = makeText('short');
    project.addComponent(comp);

    // addComponent already filed it once; watch for the re-file on edit.
    const insert = vi.spyOn(quadTreeOf(project), 'insert');
    (comp.options as unknown as { text: { value: string } }).text.value =
      'x'.repeat(100);

    // A bare redraw() would not re-file; the text option must route through
    // portsChange$ so the quad tree re-buckets the now-much-wider cull bounds.
    expect(insert).toHaveBeenCalledWith(comp);
  });
});
