import 'pixi.js/math-extras';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Point } from 'pixi.js';
import { configureTestBed } from '../../../testing/configure-test-bed';
import {
  makeAnd,
  makeButton,
  makeLever,
  makeRom
} from '../../../testing/factories';
import { Component } from '../../components/component';
import { Project } from '../../project/project';
import { WorkMode } from '../../work-mode/work-mode.enum';
import { PointerInput } from './pointer-input';
import { WorkModeRouter } from './work-mode-router';

/** PointerInput whose grid and global both sit at (x, y). */
function makeInput(x: number, y: number): PointerInput {
  return {
    pointerId: 1,
    pointerType: 'mouse',
    global: new Point(x, y),
    grid: new Point(x, y)
  };
}

describe('WorkModeRouter in SIMULATION mode', () => {
  let project: Project;
  let router: WorkModeRouter;
  let emissions: Component[];
  let tickerValues: string[];

  beforeEach(() => {
    configureTestBed();
    project = new Project();
    router = new WorkModeRouter();
    router.setProject(project);
    emissions = [];
    tickerValues = [];
    project.userInput$.subscribe((component) => emissions.push(component));
    project.ticker$.subscribe((value) => tickerValues.push(value));
  });

  afterEach(() => {
    router.destroy();
    project.destroy({ children: true });
  });

  it('emits userInput$ for a tapped button', () => {
    const button = makeButton(2, 2);
    project.addComponent(button);
    router.setMode(WorkMode.SIMULATION);

    router.down(makeInput(2.4, 2.6));
    router.up(); // a tap (no movement) activates the button

    expect(emissions).toEqual([button]);
  });

  it('emits userInput$ for a tapped lever', () => {
    const lever = makeLever(0, 0);
    project.addComponent(lever);
    router.setMode(WorkMode.SIMULATION);

    router.down(makeInput(0.5, 0.5));
    router.up();

    expect(emissions).toEqual([lever]);
  });

  it('emits inspectRequest$ for a tapped inspectable component', () => {
    const rom = makeRom(2, 4, '', 2, 2);
    project.addComponent(rom);
    const inspections: Component[] = [];
    project.inspectRequest$.subscribe((component) =>
      inspections.push(component)
    );
    router.setMode(WorkMode.SIMULATION);

    router.down(makeInput(3, 3)); // inside the ROM body
    router.up();

    expect(inspections).toEqual([rom]);
    expect(emissions).toEqual([]); // an inspect tap is not user input
  });

  it('emits nothing for other components or empty canvas', () => {
    project.addComponent(makeAnd(2, undefined, 2, 2));
    router.setMode(WorkMode.SIMULATION);

    router.down(makeInput(3, 3)); // inside the AND body
    router.up();
    router.down(makeInput(20, 20)); // empty canvas
    router.up();

    expect(emissions).toEqual([]);
  });

  it('pans on a one-finger drag instead of activating a component', () => {
    const button = makeButton(2, 2);
    project.addComponent(button);
    const panSpy = vi.spyOn(project, 'pan');
    router.setMode(WorkMode.SIMULATION);

    router.down(makeInput(2.4, 2.6));
    router.move(makeInput(60, 60)); // well past the tap threshold
    router.up();

    expect(panSpy).toHaveBeenCalled();
    expect(emissions).toEqual([]); // it was a pan, not a tap
  });

  it('entering simulation mode cancels an active drag', () => {
    router.setMode(WorkMode.WIRE_DRAWING);
    router.down(makeInput(5, 5));
    expect(tickerValues).toContain('on');
    tickerValues.length = 0;

    router.setMode(WorkMode.SIMULATION);

    expect(tickerValues).toContain('off');
  });

  it('switching projects cancels an active drag on the old one', () => {
    router.setMode(WorkMode.WIRE_DRAWING);
    router.down(makeInput(5, 5));
    tickerValues.length = 0;

    const other = new Project();
    router.setProject(other);

    expect(tickerValues).toContain('off');
    router.setProject(null);
    other.destroy({ children: true });
  });
});

describe('WorkModeRouter in PORT_NEGATION mode', () => {
  let project: Project;
  let router: WorkModeRouter;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
    router = new WorkModeRouter();
    router.setProject(project);
  });

  afterEach(() => {
    router.destroy();
    project.destroy({ children: true });
  });

  it('toggles negation on the clicked input port, undoably', () => {
    const and = makeAnd(2, undefined, 2, 2);
    project.addComponent(and);
    router.setMode(WorkMode.PORT_NEGATION);
    const cp = and.connectionPoints; // 0,1 inputs; 2 output

    router.down(makeInput(cp[0].x, cp[0].y));

    expect(and.isPortNegated('in', 0)).toBe(true);
    expect(project.actionManager.undoAvailable).toBe(true);

    project.actionManager.undo();
    expect(and.isPortNegated('in', 0)).toBe(false);
  });

  it('toggles the output port back off on a second click', () => {
    const and = makeAnd(2, undefined, 2, 2);
    project.addComponent(and);
    router.setMode(WorkMode.PORT_NEGATION);
    const out = and.connectionPoints[2];

    router.down(makeInput(out.x, out.y));
    expect(and.isPortNegated('out', 0)).toBe(true);

    router.down(makeInput(out.x, out.y));
    expect(and.isPortNegated('out', 0)).toBe(false);
  });

  it('does nothing when the click is outside port tolerance', () => {
    const and = makeAnd(2, undefined, 2, 2);
    project.addComponent(and);
    router.setMode(WorkMode.PORT_NEGATION);
    const cp = and.connectionPoints[0];

    // 0.3gu away — within the quad-tree query box but past the 0.25gu hit test.
    router.down(makeInput(cp.x + 0.3, cp.y));

    expect(and.isPortNegated('in', 0)).toBe(false);
    expect(project.actionManager.undoAvailable).toBe(false);
  });

  it('does nothing when clicking empty canvas', () => {
    project.addComponent(makeAnd(2, undefined, 2, 2));
    router.setMode(WorkMode.PORT_NEGATION);

    router.down(makeInput(20, 20));

    expect(project.actionManager.undoAvailable).toBe(false);
  });

  it('shows the hover ghost over a port and hides it off-port', () => {
    const and = makeAnd(2, undefined, 2, 2);
    project.addComponent(and);
    router.setMode(WorkMode.PORT_NEGATION);
    const cp = and.connectionPoints[0];

    router.hover(makeInput(cp.x, cp.y));
    const ghost = project.floatingLayer.children.find(
      (child) => child !== project.floatingLayer.dragLayer
    );
    expect(ghost?.visible).toBe(true);

    router.hover(makeInput(20, 20));
    expect(ghost?.visible).toBe(false);
  });

  it('hides the hover ghost when leaving the mode', () => {
    const and = makeAnd(2, undefined, 2, 2);
    project.addComponent(and);
    router.setMode(WorkMode.PORT_NEGATION);
    const cp = and.connectionPoints[0];
    router.hover(makeInput(cp.x, cp.y));

    router.setMode(WorkMode.SELECT);

    const ghost = project.floatingLayer.children.find(
      (child) => child !== project.floatingLayer.dragLayer
    );
    expect(ghost?.visible).toBe(false);
  });
});
