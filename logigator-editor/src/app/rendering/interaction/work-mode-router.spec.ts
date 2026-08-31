import 'pixi.js/math-extras';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance
} from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Point, Rectangle } from 'pixi.js';
import { configureTestBed } from '../../../testing/configure-test-bed';
import {
  makeAnd,
  makeButton,
  makeSwitch,
  makeRom,
  makeWire
} from '../../../testing/factories';
import { Direction, WireDirection } from '@logigator/core';
import { Component } from '../../components/component';
import { ComponentConfig } from '../../components/component-config.model';
import { andComponentConfig } from '../../components/component-types/and/and.config';
import { notComponentConfig } from '../../components/component-types/not/not.config';
import { CustomComponentService } from '../../custom-component/custom-component.service';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { ThemingService } from '../../theming/theming.service';
import { environment } from '../../../environments/environment';
import { Project } from '../../project/project';
import { WorkMode } from '../../work-mode/work-mode.enum';
import { PointerInput } from './pointer-input';
import { WorkModeRouter } from './work-mode-router';
import { groupGridBounds } from '../sessions/rotate-elements';

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

  it('emits userInput$ for a tapped switch', () => {
    const switchComp = makeSwitch(0, 0);
    project.addComponent(switchComp);
    router.setMode(WorkMode.SIMULATION);

    router.down(makeInput(0.5, 0.5));
    router.up();

    expect(emissions).toEqual([switchComp]);
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
    const panSpy = vi.spyOn(project.viewport, 'pan');
    router.setMode(WorkMode.SIMULATION);

    router.down(makeInput(2.4, 2.6));
    router.move(makeInput(60, 60)); // well past the tap threshold
    router.up();

    expect(panSpy).toHaveBeenCalled();
    expect(emissions).toEqual([]); // it was a pan, not a tap
  });

  it('entering simulation mode cancels an active drag', () => {
    router.setMode(WorkMode.WIRE_TOOL);
    router.down(makeInput(5, 5));
    expect(tickerValues).toContain('on');
    tickerValues.length = 0;

    router.setMode(WorkMode.SIMULATION);

    expect(tickerValues).toContain('off');
  });

  it('switching projects cancels an active drag on the old one', () => {
    router.setMode(WorkMode.WIRE_TOOL);
    router.down(makeInput(5, 5));
    tickerValues.length = 0;

    const other = new Project();
    router.setProject(other);

    expect(tickerValues).toContain('off');
    router.setProject(null);
    other.destroy({ children: true });
  });
});

describe('WorkModeRouter in SELECT mode', () => {
  let project: Project;
  let router: WorkModeRouter;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
    router = new WorkModeRouter();
    router.setProject(project);
    router.setMode(WorkMode.SELECT);
  });

  afterEach(() => {
    router.destroy();
    project.destroy({ children: true });
  });

  it('dragging from the grab margin (off the element bounds) moves the selection', () => {
    // AND at (3,3): gridBounds x ∈ [2.5, 5.5], y ∈ [3, 5].
    const comp = makeAnd(2);
    comp.position.set(3, 3);
    project.addComponent(comp);
    project.selectionManager.select([comp], []);

    // Outside the component bounds but inside the padded grab rect.
    router.down(makeInput(2, 5.5));
    router.move(makeInput(6, 5.5));
    router.up();

    expect(comp.position.x).toBe(7);
    expect(comp.position.y).toBe(3);
  });

  it('freezes a selection move on an invalid release instead of discarding it', () => {
    const comp = makeAnd(2);
    comp.position.set(3, 3);
    project.addComponent(comp);
    project.addComponent(makeAnd(2, undefined, 8, 3));
    project.selectionManager.select([comp], []);

    router.down(makeInput(2, 5.5));
    router.move(makeInput(7, 5.5)); // overlaps the second AND
    router.up(); // released over a collision

    expect(router.hasActiveSession).toBe(true); // still frozen, awaiting a valid drop

    // The release ended the gesture, so the frozen group needs a fresh press
    // before it moves again, and the move commits from where that press
    // landed rather than the first one.
    router.down(makeInput(7, 5.5));
    router.move(makeInput(3, 5.5));
    router.up();
    expect(router.hasActiveSession).toBe(false);
    expect(comp.position.x).toBe(4);
  });

  it('pressing outside the grab rect starts a new selection instead', () => {
    const comp = makeAnd(2);
    comp.position.set(3, 3);
    project.addComponent(comp);
    project.selectionManager.select([comp], []);

    // Well outside the grab rect: a fresh, empty click-select.
    router.down(makeInput(10, 10));
    router.up();

    expect(comp.position.x).toBe(3);
    expect(project.selectionManager.isEmpty).toBe(true);
  });

  it('a plain marquee selects a crossing wire whole', () => {
    // x ∈ [0.5, 4.5] at y 2.5 — extends past the marquee's right edge.
    const wire = makeWire(0, 2, WireDirection.HORIZONTAL, 4);
    project.addWire(wire);

    router.down(makeInput(0, 0));
    router.move(makeInput(2.5, 3));
    router.up();

    expect(Array.from(project.wires)).toHaveLength(1);
    expect(project.selectionManager.selectedWires.has(wire)).toBe(true);
  });

  it('holding the scissor key scissors wires at the marquee edge', () => {
    const wire = makeWire(0, 2, WireDirection.HORIZONTAL, 4);
    project.addWire(wire);

    // Default SELECT_SCISSOR binding: a bare Alt.
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Alt', altKey: true })
    );
    try {
      router.down(makeInput(0, 0));
      router.move(makeInput(2.5, 3));
      router.up();
    } finally {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt' }));
    }

    // Cut at x = 2.5, the first half-grid position at or outside the rect's
    // right edge: the inside piece is selected, the outside remnant is not.
    const wires = Array.from(project.wires);
    expect(wires).toHaveLength(2);
    const selected = Array.from(project.selectionManager.selectedWires);
    expect(selected).toHaveLength(1);
    expect(selected[0].length).toBe(2);
  });

  it('the scissor mode set by the toggle scissors without any key held', () => {
    const wire = makeWire(0, 2, WireDirection.HORIZONTAL, 4);
    project.addWire(wire);
    router.setMode(WorkMode.SELECT_EXACT);

    router.down(makeInput(0, 0));
    router.move(makeInput(2.5, 3));
    router.up();

    expect(Array.from(project.wires)).toHaveLength(2);
  });
});

describe('WorkModeRouter cancel shortcut (Escape)', () => {
  let project: Project;
  let router: WorkModeRouter;
  let setMode: MockInstance<(mode: WorkMode) => void>;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
    router = new WorkModeRouter();
    router.setProject(project);
    setMode = vi.spyOn(TestBed.inject(WorkModeService), 'setMode');
  });

  afterEach(() => {
    router.destroy();
    project.destroy({ children: true });
  });

  /** The default CANCEL binding is a bare Escape. */
  function pressEscape(): void {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  }

  it('clears a live selection before touching the tool', () => {
    router.setMode(WorkMode.SELECT);
    const comp = makeAnd(2, undefined, 3, 3);
    project.addComponent(comp);
    project.selectionManager.select([comp], []);

    pressEscape();

    expect(project.selectionManager.isEmpty).toBe(true);
    expect(setMode).not.toHaveBeenCalled(); // stays in SELECT
  });

  it('falls back to the pan tool once the selection is empty', () => {
    router.setMode(WorkMode.SELECT);
    const comp = makeAnd(2, undefined, 3, 3);
    project.addComponent(comp);
    project.selectionManager.select([comp], []);

    pressEscape(); // first: clears the selection
    expect(project.selectionManager.isEmpty).toBe(true);
    expect(setMode).not.toHaveBeenCalled();

    pressEscape(); // second: nothing left to clear → back to pan
    expect(setMode).toHaveBeenCalledWith(WorkMode.PAN);
  });

  it('returns to the pan tool from any non-pan tool with nothing selected', () => {
    router.setMode(WorkMode.WIRE_TOOL);

    pressEscape();

    expect(setMode).toHaveBeenCalledWith(WorkMode.PAN);
  });

  it('does nothing extra when already in the pan tool with no selection', () => {
    router.setMode(WorkMode.PAN);

    pressEscape();

    expect(setMode).not.toHaveBeenCalled();
  });

  it('aborts an active drag first and does not also escalate on that press', () => {
    router.setMode(WorkMode.SELECT);
    router.down(makeInput(0, 0));
    router.move(makeInput(3, 3)); // a marquee drag is now live
    expect(router.hasActiveSession).toBe(true);

    pressEscape();

    expect(router.hasActiveSession).toBe(false); // drag aborted
    expect(setMode).not.toHaveBeenCalled(); // no escalation on the same press
  });
});

describe('WorkModeRouter move-selection shortcuts (arrow keys)', () => {
  let project: Project;
  let router: WorkModeRouter;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
    router = new WorkModeRouter();
    router.setProject(project);
    router.setMode(WorkMode.SELECT);
  });

  afterEach(() => {
    router.destroy();
    project.destroy({ children: true });
  });

  function press(key: string): void {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
  }

  it('moves the committed selection one grid unit and records one undo step', () => {
    const comp = makeAnd(2, undefined, 3, 3);
    project.addComponent(comp);
    project.selectionManager.select([comp], []);

    press('ArrowDown');

    expect(comp.position.x).toBe(3);
    expect(comp.position.y).toBe(4);
    expect(router.hasActiveSession).toBe(false); // committed synchronously
    expect(project.selectionManager.selectedComponents.has(comp)).toBe(true);

    project.actionManager.undo();
    expect(comp.position.y).toBe(3);
    expect(project.actionManager.undoAvailable).toBe(false); // one entry per press
  });

  it('maps each arrow key to its axis', () => {
    const comp = makeAnd(2, undefined, 5, 5);
    project.addComponent(comp);
    project.selectionManager.select([comp], []);

    press('ArrowUp');
    press('ArrowUp');
    press('ArrowLeft');
    press('ArrowRight');

    expect(comp.position.x).toBe(5);
    expect(comp.position.y).toBe(3);
  });

  it('keeps the session floating on a colliding move; Escape reverts it', () => {
    // The bodies touch edge-on; one step down makes them overlap.
    const stationary = makeAnd(2, undefined, 3, 5);
    project.addComponent(stationary);
    const comp = makeAnd(2, undefined, 3, 3);
    project.addComponent(comp);
    project.selectionManager.select([comp], []);

    press('ArrowDown');

    expect(router.hasActiveSession).toBe(true); // floats instead of committing
    expect(project.actionManager.undoAvailable).toBe(false);

    press('Escape');

    expect(router.hasActiveSession).toBe(false);
    expect(comp.position.x).toBe(3);
    expect(comp.position.y).toBe(3); // move reverted
  });

  it('commits a floating session the moment a further move clears the collision', () => {
    const stationary = makeAnd(2, undefined, 3, 5);
    project.addComponent(stationary);
    const comp = makeAnd(2, undefined, 3, 3);
    project.addComponent(comp);
    project.selectionManager.select([comp], []);

    press('ArrowDown'); // collides → session stays open
    press('ArrowLeft'); // still overlapping stationary's body
    press('ArrowLeft'); // still overlapping stationary's input stubs
    expect(router.hasActiveSession).toBe(true);

    press('ArrowLeft'); // clear of it now → the float commits in place

    expect(router.hasActiveSession).toBe(false);
    expect(comp.position.x).toBe(0);
    expect(comp.position.y).toBe(4);
    expect(project.selectionManager.selectedComponents.has(comp)).toBe(true);

    // The whole float-then-recover run is one undo step.
    project.actionManager.undo();
    expect(comp.position.x).toBe(3);
    expect(comp.position.y).toBe(3);
    expect(project.actionManager.undoAvailable).toBe(false);
  });

  it('is inert with an empty selection and in simulation mode', () => {
    const comp = makeAnd(2, undefined, 3, 3);
    project.addComponent(comp);

    press('ArrowDown'); // nothing selected
    expect(comp.position.y).toBe(3);

    project.selectionManager.select([comp], []);
    router.setMode(WorkMode.SIMULATION);

    press('ArrowDown'); // editing locked
    expect(comp.position.y).toBe(3);
  });
});

describe('WorkModeRouter rotate-selection requests', () => {
  let project: Project;
  let router: WorkModeRouter;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
    router = new WorkModeRouter();
    router.setProject(project);
    router.setMode(WorkMode.SELECT);
  });

  afterEach(() => {
    router.destroy();
    project.destroy({ children: true });
  });

  it('rotates the committed selection and commits synchronously when clear', () => {
    const comp = makeAnd(3, Direction.E, 5, 5);
    project.addComponent(comp);
    project.selectionManager.select([comp], []);
    const before = comp.direction;

    project.requestSelectionRotation(1);

    expect(router.hasActiveSession).toBe(false); // committed in place
    expect(comp.direction).not.toBe(before);
    expect(project.actionManager.undoAvailable).toBe(true);
  });

  it('commits a colliding rotation once a second turn clears it — no revert on click-off', () => {
    // The obstacle sits only in the one-quarter-turn footprint, so the first
    // rotate floats and the second clears it.
    const obstacle = makeAnd(2, Direction.E, 2, 6);
    project.addComponent(obstacle);
    const comp = makeAnd(3, Direction.E, 5, 5);
    project.addComponent(comp);
    project.selectionManager.select([comp], []);

    project.requestSelectionRotation(1); // collides → session floats
    expect(router.hasActiveSession).toBe(true);
    expect(project.actionManager.undoAvailable).toBe(false);

    project.requestSelectionRotation(1); // clear now → the float commits

    expect(router.hasActiveSession).toBe(false);
    expect(comp.direction).toBe(Direction.W);
    expect(project.selectionManager.selectedComponents.has(comp)).toBe(true);
    expect(project.actionManager.undoAvailable).toBe(true);

    project.actionManager.undo();
    expect(comp.direction).toBe(Direction.E); // the whole recovery is one step
  });

  it('does not revert a committed rotation on a later press off the selection', () => {
    const obstacle = makeAnd(2, Direction.E, 2, 6);
    project.addComponent(obstacle);
    const comp = makeAnd(3, Direction.E, 5, 5);
    project.addComponent(comp);
    project.selectionManager.select([comp], []);

    project.requestSelectionRotation(1); // floats
    project.requestSelectionRotation(1); // clears → commits
    expect(router.hasActiveSession).toBe(false);

    // A press elsewhere must not snap back a rotation that already committed.
    router.down(makeInput(20, 20));
    expect(comp.direction).toBe(Direction.W);
  });

  it('does not auto-commit a rotate mid pointer-drag even when momentarily valid', () => {
    const comp = makeAnd(3, Direction.E, 5, 5);
    project.addComponent(comp);
    project.selectionManager.select([comp], []);

    // A live drag has its anchor locked, so isAwaitingGrab() is false and the
    // auto-commit guard must not fire.
    router.down(makeInput(6, 6));
    router.move(makeInput(8, 8));
    expect(router.hasActiveSession).toBe(true);

    project.requestSelectionRotation(1); // collision-free, but held under cursor

    expect(router.hasActiveSession).toBe(true); // stays live — no commit
    expect(project.actionManager.undoAvailable).toBe(false);

    router.up(); // release is what commits
    expect(router.hasActiveSession).toBe(false);
    expect(project.actionManager.undoAvailable).toBe(true);
  });
});

describe('WorkModeRouter wire-tool taps (WIRE_TOOL mode)', () => {
  let project: Project;
  let router: WorkModeRouter;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
    router = new WorkModeRouter();
    router.setProject(project);
    router.setMode(WorkMode.WIRE_TOOL);
  });

  afterEach(() => {
    router.destroy();
    project.destroy({ children: true });
  });

  /** A press-and-release without movement. */
  function tap(x: number, y: number): void {
    router.down(makeInput(x, y));
    router.up();
  }

  it('toggles negation on the tapped input port, undoably', () => {
    const and = makeAnd(2, undefined, 2, 2);
    project.addComponent(and);
    const cp = and.connectionPoints; // 0,1 inputs; 2 output

    tap(cp[0].x, cp[0].y);

    expect(and.isPortNegated('in', 0)).toBe(true);
    expect(project.actionManager.undoAvailable).toBe(true);

    project.actionManager.undo();
    expect(and.isPortNegated('in', 0)).toBe(false);
  });

  it('toggles the output port back off on a second tap', () => {
    const and = makeAnd(2, undefined, 2, 2);
    project.addComponent(and);
    const out = and.connectionPoints[2];

    tap(out.x, out.y);
    expect(and.isPortNegated('out', 0)).toBe(true);

    tap(out.x, out.y);
    expect(and.isPortNegated('out', 0)).toBe(false);
  });

  it('splits crossing wires on a tap and rejoins them on a second tap', () => {
    // The wires cross at (2.5, 2.5) without either ending there.
    project.addWire(makeWire(0, 2, WireDirection.HORIZONTAL, 4));
    project.addWire(makeWire(2, 0, WireDirection.VERTICAL, 4));

    tap(2.5, 2.5);
    expect(Array.from(project.wires)).toHaveLength(4);

    tap(2.5, 2.5);
    expect(Array.from(project.wires)).toHaveLength(2);
  });

  it('negates the port rather than toggling a connection when both are in reach', () => {
    const and = makeAnd(2, undefined, 2, 2);
    project.addComponent(and);
    const cp = and.connectionPoints[0];
    const toggleSpy = vi.spyOn(project.topology, 'toggleConnectionAt');

    tap(cp.x, cp.y);

    expect(and.isPortNegated('in', 0)).toBe(true);
    expect(toggleSpy).not.toHaveBeenCalled();
  });

  it('does nothing when the tap is outside port tolerance on empty canvas', () => {
    const and = makeAnd(2, undefined, 2, 2);
    project.addComponent(and);
    const cp = and.connectionPoints[0];

    // 0.51gu away — within the quad-tree query box but past the 0.5gu hit test.
    tap(cp.x + 0.51, cp.y);

    expect(and.isPortNegated('in', 0)).toBe(false);
    expect(project.actionManager.undoAvailable).toBe(false);
  });

  it('a drag draws a wire and triggers no tap action', () => {
    project.addWire(makeWire(0, 2, WireDirection.HORIZONTAL, 4));
    project.addWire(makeWire(2, 0, WireDirection.VERTICAL, 4));

    router.down(makeInput(2.5, 2.5)); // starts on the crossing
    router.move(makeInput(2.5, 8.5));
    router.up();

    // The new piece merges into the collinear vertical wire (y 0.5–8.5), and
    // the crossing is not split.
    const lengths = Array.from(project.wires, (w) => w.length).sort();
    expect(lengths).toEqual([4, 8]);
  });

  it('discards a wire dragged over a component body on release', () => {
    const and = makeAnd(2, undefined, 2, 2); // body around (2..4, 2..4)
    project.addComponent(and);

    router.down(makeInput(3, 8)); // clear of the body
    router.move(makeInput(3, 3)); // wire runs up into the body
    router.up(); // released while colliding

    expect(router.hasActiveSession).toBe(false); // discarded, not frozen
    expect(Array.from(project.wires)).toHaveLength(0);
    expect(project.actionManager.undoAvailable).toBe(false);
  });

  it('a drag that returns to its origin neither draws nor taps', () => {
    project.addWire(makeWire(0, 2, WireDirection.HORIZONTAL, 4));
    project.addWire(makeWire(2, 0, WireDirection.VERTICAL, 4));

    router.down(makeInput(2.5, 2.5));
    router.move(makeInput(2.5, 8.5));
    router.move(makeInput(2.5, 2.5)); // back to a zero-length preview
    router.up();

    expect(Array.from(project.wires)).toHaveLength(2);
    expect(project.actionManager.undoAvailable).toBe(false);
  });

  it('previews removal for an already-negated port', () => {
    const and = makeAnd(2, undefined, 2, 2);
    and.setPortNegated('in', 0, true);
    project.addComponent(and);
    const show = vi.spyOn(project.floatingLayer, 'showNegationGhost');
    const cp = and.connectionPoints[0];

    router.hover(makeInput(cp.x, cp.y));

    expect(show).toHaveBeenCalledWith(
      expect.anything(),
      'in',
      expect.anything(),
      true // willRemove — the tap would take the bubble away
    );
  });

  it('shows the negation ghost over a port and hides it off-port', () => {
    const and = makeAnd(2, undefined, 2, 2);
    project.addComponent(and);
    const cp = and.connectionPoints[0];

    router.hover(makeInput(cp.x, cp.y));
    expect(project.floatingLayer.negationGhostVisible).toBe(true);

    router.hover(makeInput(20, 20));
    expect(project.floatingLayer.negationGhostVisible).toBe(false);
  });

  it('hides the hover ghosts when leaving the mode', () => {
    const and = makeAnd(2, undefined, 2, 2);
    project.addComponent(and);
    const cp = and.connectionPoints[0];
    router.hover(makeInput(cp.x, cp.y));

    router.setMode(WorkMode.SELECT);

    expect(project.floatingLayer.negationGhostVisible).toBe(false);
  });

  it('keeps the negation ghost visible while pressed, hides it once the drag starts', () => {
    const and = makeAnd(2, undefined, 2, 2);
    project.addComponent(and);
    const cp = and.connectionPoints[0];
    router.hover(makeInput(cp.x, cp.y));
    expect(project.floatingLayer.negationGhostVisible).toBe(true);

    router.down(makeInput(cp.x, cp.y));
    expect(project.floatingLayer.negationGhostVisible).toBe(true);

    router.move(makeInput(cp.x - 3, cp.y)); // away from the body: a real drag
    expect(project.floatingLayer.negationGhostVisible).toBe(false);
    router.up();
  });

  it('shows the connection ghost over a toggleable crossing and hides it off-wire', () => {
    project.addWire(makeWire(0, 2, WireDirection.HORIZONTAL, 4));
    project.addWire(makeWire(2, 0, WireDirection.VERTICAL, 4));

    router.hover(makeInput(2.5, 2.5)); // pure crossing → split preview
    expect(project.floatingLayer.connectionGhostVisible).toBe(true);

    router.hover(makeInput(20, 20));
    expect(project.floatingLayer.connectionGhostVisible).toBe(false);
  });

  it('shows no connection ghost over a T-junction — a tap there is a no-op', () => {
    project.addWire(makeWire(0, 2, WireDirection.HORIZONTAL, 2));
    project.addWire(makeWire(2, 2, WireDirection.HORIZONTAL, 3));
    project.addWire(makeWire(2, 0, WireDirection.VERTICAL, 2));

    router.hover(makeInput(2.5, 2.5));

    expect(project.floatingLayer.connectionGhostVisible).toBe(false);
  });

  it('refreshes the connection ghost in place after a tap toggles the junction', () => {
    project.addWire(makeWire(0, 2, WireDirection.HORIZONTAL, 4));
    project.addWire(makeWire(2, 0, WireDirection.VERTICAL, 4));
    router.hover(makeInput(2.5, 2.5));

    tap(2.5, 2.5); // splits — the point is now a joinable CP

    expect(project.floatingLayer.connectionGhostVisible).toBe(true);
    expect(project.topology.connectionToggleKindAt(new Point(2.5, 2.5))).toBe(
      'join'
    );
  });
});

describe('WorkModeRouter placement hover ghost (COMPONENT_PLACEMENT mode)', () => {
  let project: Project;
  let router: WorkModeRouter;
  let ensure: MockInstance<(masterTypeId: number) => Promise<boolean>>;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
    router = new WorkModeRouter();
    router.setProject(project);
    ensure = vi.spyOn(
      TestBed.inject(CustomComponentService),
      'ensureMasterCircuit'
    );
    router.setMode(WorkMode.COMPONENT_PLACEMENT);
    router.componentToPlace = andComponentConfig as unknown as ComponentConfig;
  });

  afterEach(() => {
    router.destroy();
    project.destroy({ children: true });
  });

  const ghosts = () => project.floatingLayer.dragLayer.children;

  it('hovering shows a grid-snapped ghost of the component to place', () => {
    router.hover(makeInput(2.3, 3.4));

    expect(ghosts()).toHaveLength(1);
    expect(ghosts()[0].position).toMatchObject({ x: 2, y: 3 });
  });

  it('the ghost follows later hovers without stacking new instances', () => {
    router.hover(makeInput(2, 2));
    const ghost = ghosts()[0];

    router.hover(makeInput(5.6, 1.2));

    expect(ghosts()).toEqual([ghost]);
    expect(ghost.position).toMatchObject({ x: 6, y: 1 });
  });

  it('tints the ghost invalid over a collision and restores it off one', () => {
    project.addComponent(makeAnd(2, undefined, 2, 2));
    const invalid = TestBed.inject(ThemingService).currentTheme().invalid;

    router.hover(makeInput(2, 2));
    expect(ghosts()[0].tint).toBe(invalid);

    router.hover(makeInput(20, 20));
    expect(ghosts()[0].tint).not.toBe(invalid);
  });

  it('changing the palette selection rebuilds the ghost from the new config', () => {
    router.hover(makeInput(2, 2));

    router.componentToPlace = notComponentConfig as unknown as ComponentConfig;
    expect(ghosts()).toHaveLength(0);

    router.hover(makeInput(2, 2));
    expect((ghosts()[0] as Component).config.type).toBe(
      notComponentConfig.type
    );
  });

  it('a press hands off to the placement session without stacking ghosts', async () => {
    ensure.mockResolvedValue(true);
    router.hover(makeInput(2, 2));

    router.down(makeInput(2.4, 2.4));
    await Promise.resolve();
    await Promise.resolve();

    expect(ghosts()).toHaveLength(1); // the session's ghost, not the hover one
    expect(ghosts()[0].position).toMatchObject({ x: 2, y: 2 });
  });

  it('removes the ghost when the pointer leaves the canvas', () => {
    router.hover(makeInput(2, 2));

    router.leave();

    expect(ghosts()).toHaveLength(0);
  });

  it('removes the ghost when switching modes', () => {
    router.hover(makeInput(2, 2));

    router.setMode(WorkMode.SELECT);

    expect(ghosts()).toHaveLength(0);
  });
});

describe('WorkModeRouter component placement circuit load', () => {
  let project: Project;
  let router: WorkModeRouter;
  let ensure: MockInstance<(masterTypeId: number) => Promise<boolean>>;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
    router = new WorkModeRouter();
    router.setProject(project);
    ensure = vi.spyOn(
      TestBed.inject(CustomComponentService),
      'ensureMasterCircuit'
    );
    router.setMode(WorkMode.COMPONENT_PLACEMENT);
    router.componentToPlace = andComponentConfig as unknown as ComponentConfig;
  });

  afterEach(() => {
    router.destroy();
    project.destroy({ children: true });
  });

  /** The drag ghost the placement session adds while it is open. */
  const ghostCount = () => project.floatingLayer.dragLayer.children.length;

  it('opens the placement session once the circuit load resolves', async () => {
    ensure.mockResolvedValue(true);

    router.down(makeInput(2, 2));
    await Promise.resolve();
    await Promise.resolve();

    expect(ghostCount()).toBe(1);
  });

  it('opens no session when the pointer is released before the load resolves', async () => {
    let resolve!: (ready: boolean) => void;
    ensure.mockReturnValue(new Promise<boolean>((r) => (resolve = r)));

    router.down(makeInput(2, 2)); // arms the async circuit load
    router.up(); // pointer released while the load is still in flight

    resolve(true); // the load completes only now — the gesture is already over
    await Promise.resolve();
    await Promise.resolve();

    expect(ghostCount()).toBe(0);
  });

  it('opens no session when a failed load returns false', async () => {
    ensure.mockResolvedValue(false);

    router.down(makeInput(2, 2));
    await Promise.resolve();
    await Promise.resolve();

    expect(ghostCount()).toBe(0);
  });

  it('discards the placement on an invalid release instead of freezing it', async () => {
    ensure.mockResolvedValue(true);
    project.addComponent(makeAnd(2, undefined, 2, 2)); // occupies (2..,2..)

    router.down(makeInput(20, 20));
    await Promise.resolve();
    await Promise.resolve();
    expect(ghostCount()).toBe(1);

    router.move(makeInput(2, 2)); // ghost body lands on the existing AND
    router.up(); // released over a collision

    expect(router.hasActiveSession).toBe(false); // session gone, not frozen
    expect(ghostCount()).toBe(0); // the ghost disappeared
    expect(project.actionManager.undoAvailable).toBe(false); // nothing committed
  });
});

describe('WorkModeRouter history lock around drag sessions', () => {
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

  it('locks undo/redo while a session is live and unlocks on commit', () => {
    router.setMode(WorkMode.PAN);

    router.down(makeInput(2, 2));
    expect(project.actionManager.locked).toBe(true);

    router.up();
    expect(project.actionManager.locked).toBe(false);
  });

  it('unlocks when a session is cancelled', () => {
    router.setMode(WorkMode.PAN);

    router.down(makeInput(2, 2));
    router.cancel();

    expect(project.actionManager.locked).toBe(false);
  });

  it('unlocks the old project when the router is re-homed mid-drag', () => {
    router.setMode(WorkMode.PAN);
    router.down(makeInput(2, 2));

    const other = new Project();
    router.setProject(other);

    expect(project.actionManager.locked).toBe(false);
    expect(other.actionManager.locked).toBe(false);
    other.destroy({ children: true });
  });
});

describe('WorkModeRouter paste placement', () => {
  let project: Project;
  let router: WorkModeRouter;

  // 800x600 CSS px at scale 1 and gridSize 16: a 50 x 37.5 grid view whose
  // centre sits at (25, 18.75) while the camera rests at the origin.
  const VIEW_CENTRE = new Point(25, 18.75);

  beforeEach(() => {
    configureTestBed();
    project = new Project();
    project.viewport.resizeViewport(800, 600);
    router = new WorkModeRouter();
    router.setProject(project);
  });

  afterEach(() => {
    router.destroy();
    project.destroy({ children: true });
  });

  /**
   * Rests the cursor on a grid position. The router records the canvas-local
   * position, so the hover must carry a `global` matching the grid one.
   */
  function hoverOnGrid(gx: number, gy: number, pointerType = 'mouse'): void {
    router.hover({
      pointerId: 1,
      pointerType,
      global: new Point(gx * environment.gridSize, gy * environment.gridSize),
      grid: new Point(gx, gy)
    });
  }

  /** Pastes one component copied from the origin and returns where it landed. */
  function pasteAtOrigin(): Point {
    const comp = makeAnd();
    project.startPasteSession([comp], []);
    const bounds = groupGridBounds([comp], [])!;
    return new Point(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  }

  /** The group is centred on `target` up to the half-unit snap to the grid. */
  function expectCentredOn(centre: Point, target: Point): void {
    expect(Math.abs(centre.x - target.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(centre.y - target.y)).toBeLessThanOrEqual(0.5);
  }

  it('centres the pasted group on the cursor', () => {
    hoverOnGrid(30, 12);

    expectCentredOn(pasteAtOrigin(), new Point(30, 12));
  });

  it('centres the pasted group in the view when the pointer left the canvas', () => {
    hoverOnGrid(30, 12);
    router.leave();

    expectCentredOn(pasteAtOrigin(), VIEW_CENTRE);
  });

  it('centres the pasted group in the view for touch input', () => {
    // A lifted finger leaves no cursor behind.
    hoverOnGrid(30, 12, 'touch');

    expectCentredOn(pasteAtOrigin(), VIEW_CENTRE);
  });

  it('reads the resting cursor through the camera it pastes under', () => {
    // A pan moves the camera with no pointer move behind it: the cursor rests
    // on the same canvas pixel, now a different part of the circuit.
    hoverOnGrid(30, 12);
    project.viewport.setPosition(new Point(-1600, -800)); // grid origin (100, 50)

    expectCentredOn(pasteAtOrigin(), new Point(130, 62));
  });

  it('follows the camera, so the group lands in view after a pan', () => {
    project.viewport.setPosition(new Point(-1600, -800)); // grid origin (100, 50)

    const centre = pasteAtOrigin();

    const view = project.viewport.gridView(new Rectangle());
    expect(view.contains(centre.x, centre.y)).toBe(true);
  });

  it('shifts wires by whole grid units, keeping them on their half-step', () => {
    const wire = makeWire(5, 3, WireDirection.HORIZONTAL); // (5.5, 3.5)
    project.startPasteSession([], [wire]);

    expect(wire.position.x % 1).toBe(0.5);
    expect(wire.position.y % 1).toBe(0.5);
  });

  it('drops the cursor when the router is re-homed to another project', () => {
    hoverOnGrid(30, 12);

    const other = new Project();
    other.viewport.resizeViewport(800, 600);
    router.setProject(other);

    const comp = makeAnd();
    other.startPasteSession([comp], []);
    const bounds = groupGridBounds([comp], [])!;
    expectCentredOn(
      new Point(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2),
      VIEW_CENTRE
    );

    router.setProject(null);
    other.destroy({ children: true });
  });
});
