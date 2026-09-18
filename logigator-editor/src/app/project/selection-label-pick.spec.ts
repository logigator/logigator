import 'pixi.js/math-extras';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Point, Rectangle } from 'pixi.js';
import { configureTestBed } from '../../testing/configure-test-bed';
import { Project } from './project';
import { SelectionManager } from './selection-manager';
import { Component } from '../components/component';
import { textComponentConfig } from '../components/component-types/text/text.config';
import { makeAnd } from '../../testing/factories';
import { Wire } from '../wires/wire';
import { WorkMode } from '../work-mode/work-mode.enum';
import { EraseSession } from '../rendering/sessions/erase.session';
import { WireDirection } from '@logigator/core';

/**
 * The click rules a text label takes part in, driven through a real project so
 * the quad-tree query, the component's own bounds and the pick all run as they
 * do on the board. At fontSize 12 and a 16-px grid cell the label of a
 * single-line text sits in the same grid row as its anchor cell: a cable under
 * it has to stay reachable where it is drawn.
 */
describe('SelectionManager — text label picking', () => {
  let project: Project;
  let manager: SelectionManager;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
    manager = new SelectionManager(project);
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  /** A text at (px, py) whose label runs to the right of its anchor cell. */
  function placeText(text: string, px = 0, py = 0): Component {
    const comp = Component.deserialize(
      { pos: [px, py], options: { fontSize: 12, text } },
      textComponentConfig
    );
    project.addComponent(comp);
    return comp;
  }

  /** A horizontal cable in the text's row, from x = 0.5 rightwards. */
  function placeWireInRow(length = 10): Wire {
    const wire = new Wire(WireDirection.HORIZONTAL, length);
    wire.position.set(0.5, 0.5);
    project.addWire(wire);
    return wire;
  }

  function click(x: number, y: number): void {
    manager.commit(new Rectangle(x, y, 0, 0), WorkMode.SELECT);
  }

  it('selects a text from a click on its label, well clear of the anchor cell', () => {
    const text = placeText('hello world');

    click(3, 0.5);

    expect(manager.selectedComponents.has(text)).toBe(true);
  });

  it('still selects it from a click on the anchor cell', () => {
    const text = placeText('hello world');

    click(0.5, 0.5);

    expect(manager.selectedComponents.has(text)).toBe(true);
  });

  it('selects nothing past the end of the label', () => {
    placeText('hi');

    // 'hi' is 1.8 grid units wide, so x = 4 is empty board.
    click(4, 0.5);

    expect(manager.isEmpty).toBe(true);
  });

  it('leaves a cable under the label reachable where its stroke is drawn', () => {
    const text = placeText('hello world');
    const wire = placeWireInRow();

    click(3, 0.5);

    expect(manager.selectedWires.has(wire)).toBe(true);
    expect(manager.selectedComponents.has(text)).toBe(false);
  });

  it('gives the cable the middle quarter of its cell and the label the rest', () => {
    const text = placeText('hello world');
    const wire = placeWireInRow();

    // Both points are inside the glyph band and the cable's row; the band the
    // cable keeps for itself ends an eighth of a cell off its line.
    click(3, 0.5 + 0.1);
    expect(manager.selectedWires.has(wire)).toBe(true);

    manager.clear();
    click(3, 0.5 + 0.2);
    expect(manager.selectedComponents.has(text)).toBe(true);
    expect(manager.selectedWires.has(wire)).toBe(false);
  });

  it('keeps that band a grid measure as the board zooms, not a screen one', () => {
    const text = placeText('hello world');
    const wire = placeWireInRow();
    // 0.2 units off the line: outside the quarter-cell band the cable keeps.
    const offLine = 0.5 + 0.2;

    click(3, offLine);
    expect(manager.selectedComponents.has(text)).toBe(true);

    manager.clear();
    project.viewport.zoomBy(0.5);
    click(3, offLine);

    // The band moves on screen with the label instead of widening the cable's
    // share of the cell.
    expect(manager.selectedComponents.has(text)).toBe(true);
    expect(manager.selectedWires.has(wire)).toBe(false);
  });

  it('keeps a component body in front of a label drawn beneath it', () => {
    const text = placeText('hello world');
    const gate = makeAnd(2);
    gate.position.set(2, 0);
    project.addComponent(gate);

    // Inside both the gate's body and the label's band.
    click(3, 0.5);

    expect(manager.selectedComponents.has(gate)).toBe(true);
    expect(manager.selectedComponents.has(text)).toBe(false);
  });

  it('catches the text in a marquee that only reaches the glyphs', () => {
    const text = placeText('hello world');

    manager.commit(new Rectangle(2, 0, 2, 1), WorkMode.SELECT);

    expect(manager.selectedComponents.has(text)).toBe(true);
  });

  it('erases the text when the eraser sweeps across the glyphs', () => {
    const text = placeText('hello world');

    const session = new EraseSession(project, new Point(3, 0.5));
    session.onEnd();

    expect(text.destroyed).toBe(true);
  });
});
