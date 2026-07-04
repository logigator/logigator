import 'pixi.js/math-extras';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FederatedPointerEvent, Point } from 'pixi.js';
import { configureTestBed } from '../../testing/configure-test-bed';
import {
  makeAnd,
  makeButton,
  makeLever,
  makeRom
} from '../../testing/factories';
import { Component } from '../components/component';
import { Project } from '../project/project';
import { WorkMode } from '../work-mode/work-mode.enum';
import { FloatingLayer } from './floating-layer';

function downEvent(x: number, y: number): FederatedPointerEvent {
  return {
    button: 0,
    global: new Point(x, y),
    getLocalPosition: () => new Point(x, y)
  } as unknown as FederatedPointerEvent;
}

function moveEvent(x: number, y: number): FederatedPointerEvent {
  return { global: new Point(x, y) } as unknown as FederatedPointerEvent;
}

describe('FloatingLayer in SIMULATION mode', () => {
  let project: Project;
  let layer: FloatingLayer;
  let emissions: Component[];
  let tickerValues: string[];

  beforeEach(() => {
    configureTestBed();
    project = new Project();
    layer = new FloatingLayer(project);
    emissions = [];
    tickerValues = [];
    project.userInput$.subscribe((component) => emissions.push(component));
    project.ticker$.subscribe((value) => tickerValues.push(value));
  });

  afterEach(() => {
    layer.destroy({ children: true });
    project.destroy({ children: true });
  });

  it('emits userInput$ for a tapped button', () => {
    const button = makeButton(2, 2);
    project.addComponent(button);
    layer.mode = WorkMode.SIMULATION;

    layer.emit('pointerdown', downEvent(2.4, 2.6));
    layer.emit('pointerup', moveEvent(0, 0)); // a tap (no movement) activates the button

    expect(emissions).toEqual([button]);
  });

  it('emits userInput$ for a tapped lever', () => {
    const lever = makeLever(0, 0);
    project.addComponent(lever);
    layer.mode = WorkMode.SIMULATION;

    layer.emit('pointerdown', downEvent(0.5, 0.5));
    layer.emit('pointerup', moveEvent(0, 0));

    expect(emissions).toEqual([lever]);
  });

  it('emits inspectRequest$ for a tapped inspectable component', () => {
    const rom = makeRom(2, 4, '', 2, 2);
    project.addComponent(rom);
    const inspections: Component[] = [];
    project.inspectRequest$.subscribe((component) =>
      inspections.push(component)
    );
    layer.mode = WorkMode.SIMULATION;

    layer.emit('pointerdown', downEvent(3, 3)); // inside the ROM body
    layer.emit('pointerup', moveEvent(0, 0));

    expect(inspections).toEqual([rom]);
    expect(emissions).toEqual([]); // an inspect tap is not user input
  });

  it('emits nothing for other components or empty canvas', () => {
    project.addComponent(makeAnd(2, undefined, 2, 2));
    layer.mode = WorkMode.SIMULATION;

    layer.emit('pointerdown', downEvent(3, 3)); // inside the AND body
    layer.emit('pointerup', moveEvent(0, 0));
    layer.emit('pointerdown', downEvent(20, 20)); // empty canvas
    layer.emit('pointerup', moveEvent(0, 0));

    expect(emissions).toEqual([]);
  });

  it('pans on a one-finger drag instead of activating a component', () => {
    const button = makeButton(2, 2);
    project.addComponent(button);
    const panSpy = vi.spyOn(project, 'pan');
    layer.mode = WorkMode.SIMULATION;

    layer.emit('pointerdown', downEvent(2.4, 2.6));
    layer.emit('pointermove', moveEvent(60, 60)); // well past the tap threshold
    layer.emit('pointerup', moveEvent(0, 0));

    expect(panSpy).toHaveBeenCalled();
    expect(emissions).toEqual([]); // it was a pan, not a tap
  });

  it('entering simulation mode cancels an active drag', () => {
    layer.mode = WorkMode.WIRE_DRAWING;
    layer.emit('pointerdown', downEvent(5, 5));
    expect(tickerValues).toContain('on');
    tickerValues.length = 0;

    layer.mode = WorkMode.SIMULATION;

    expect(tickerValues).toContain('off');
  });
});

describe('FloatingLayer in PORT_NEGATION mode', () => {
  let project: Project;
  let layer: FloatingLayer;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
    layer = new FloatingLayer(project);
  });

  afterEach(() => {
    layer.destroy({ children: true });
    project.destroy({ children: true });
  });

  it('toggles negation on the clicked input port, undoably', () => {
    const and = makeAnd(2, undefined, 2, 2);
    project.addComponent(and);
    layer.mode = WorkMode.PORT_NEGATION;
    const cp = and.connectionPoints; // 0,1 inputs; 2 output

    layer.emit('pointerdown', downEvent(cp[0].x, cp[0].y));

    expect(and.isPortNegated('in', 0)).toBe(true);
    expect(project.actionManager.undoAvailable).toBe(true);

    project.actionManager.undo();
    expect(and.isPortNegated('in', 0)).toBe(false);
  });

  it('toggles the output port back off on a second click', () => {
    const and = makeAnd(2, undefined, 2, 2);
    project.addComponent(and);
    layer.mode = WorkMode.PORT_NEGATION;
    const out = and.connectionPoints[2];

    layer.emit('pointerdown', downEvent(out.x, out.y));
    expect(and.isPortNegated('out', 0)).toBe(true);

    layer.emit('pointerdown', downEvent(out.x, out.y));
    expect(and.isPortNegated('out', 0)).toBe(false);
  });

  it('does nothing when the click is outside port tolerance', () => {
    const and = makeAnd(2, undefined, 2, 2);
    project.addComponent(and);
    layer.mode = WorkMode.PORT_NEGATION;
    const cp = and.connectionPoints[0];

    // 0.3gu away — within the quad-tree query box but past the 0.25gu hit test.
    layer.emit('pointerdown', downEvent(cp.x + 0.3, cp.y));

    expect(and.isPortNegated('in', 0)).toBe(false);
    expect(project.actionManager.undoAvailable).toBe(false);
  });

  it('does nothing when clicking empty canvas', () => {
    project.addComponent(makeAnd(2, undefined, 2, 2));
    layer.mode = WorkMode.PORT_NEGATION;

    layer.emit('pointerdown', downEvent(20, 20));

    expect(project.actionManager.undoAvailable).toBe(false);
  });
});
