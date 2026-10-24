import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Container, Point, Rectangle } from 'pixi.js';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { Project } from '../../project/project';
import { Wire } from '../../wires/wire';
import { Direction, WireDirection } from '@logigator/core';
import { textComponentConfig } from '../../components/component-types/text/text.config';
import { Component } from '../../components/component';
import { ComponentConfig } from '../../components/component-config.model';
import { ComponentOption } from '../../components/component-option';
import { ComponentPlacementSession } from './component-placement.session';
import {
  makeAnd,
  makeMoveInput,
  makeNot,
  makeWire
} from '../../../testing/factories';
import { andComponentConfig } from '../../components/component-types/and/and.config';
import { notComponentConfig } from '../../components/component-types/not/not.config';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { ComponentProviderService } from '../../components/component-provider.service';

describe('ComponentPlacementSession collision', () => {
  let project: Project;
  let dragLayer: Container<Component | Wire>;
  let session: ComponentPlacementSession;
  let placeConfig: ComponentConfig;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
    dragLayer = new Container<Component | Wire>();
    placeConfig = andComponentConfig as unknown as ComponentConfig<
      Record<string, ComponentOption>
    >;
  });

  afterEach(() => {
    session?.onCancel();
    dragLayer.destroy();
    project.destroy({ children: true });
  });

  // The session follows a cursor: an AND's 2×2 body centres on it, so a
  // cursor at (x+1, y+1) places the gate at (x, y).

  it('canEnd() is true when placed on empty ground', () => {
    session = new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(1, 1),
      placeConfig
    );
    expect(session.canEnd()).toBe(true);
  });

  it('canEnd() is false when body overlaps an existing component', () => {
    const existing = makeAnd();
    existing.position.set(0, 0);
    project.addComponent(existing);
    session = new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(1, 1),
      placeConfig
    );
    expect(session.canEnd()).toBe(false);
  });

  it('canEnd() is false when body lands on a wire — catches missing wire check bug', () => {
    // Body Rectangle(5,0,2,2); wire gridBounds [3,7)×[0,1) enters it at x=5.
    const wire = makeWire(3, 0, WireDirection.HORIZONTAL, 3);
    project.addWire(wire);
    session = new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(6, 1),
      placeConfig
    );
    expect(session.canEnd()).toBe(false);
    wire.destroy();
  });

  it('canEnd() is true when wire ends at the stub boundary (not inside body)', () => {
    // Wire right = 5 equals body left = 5: touching, not overlapping.
    const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 4);
    project.addWire(wire);
    session = new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(6, 1),
      placeConfig
    );
    expect(session.canEnd()).toBe(true);
    wire.destroy();
  });

  it('canEnd() clears to true after onMove moves body off the wire', () => {
    const wire = makeWire(3, 0, WireDirection.HORIZONTAL, 3);
    project.addWire(wire);
    session = new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(6, 1),
      placeConfig
    );
    expect(session.canEnd()).toBe(false);

    session.onMove(makeMoveInput(21, 1));
    expect(session.canEnd()).toBe(true);
    wire.destroy();
  });

  it('canEnd() sets to false after onMove moves body onto a wire', () => {
    const wire = makeWire(3, 0, WireDirection.HORIZONTAL, 3);
    project.addWire(wire);
    session = new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(1, 11),
      placeConfig
    );
    expect(session.canEnd()).toBe(true);

    session.onMove(makeMoveInput(6, 1));
    expect(session.canEnd()).toBe(false);
    wire.destroy();
  });

  it('placing a component whose port lands on a wire interior splits the wire', () => {
    // The vertical wire passes through both input ports in its interior while
    // only touching the body (body x ∈ [4,6), wire right = 4).
    const v = new Wire(WireDirection.VERTICAL, 5);
    v.position.set(3.5, -2.5);
    project.addWire(v);

    session = new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(5, 1),
      placeConfig
    );
    expect(session.canEnd()).toBe(true);
    session.onEnd();

    const huge = new Rectangle(-100, -100, 200, 200);
    const wires = project.queryWiresInRange(huge);
    expect(wires.find((w) => w.id === v.id)).toBeUndefined();
    const verticals = wires.filter(
      (w) => w.direction === WireDirection.VERTICAL
    );
    expect(verticals.length).toBe(3);
    const lengths = verticals.map((w) => w.length).sort();
    expect(lengths).toEqual([1, 1, 3]);
  });

  // East at (0,0): body [0,2]×[0,1], output stub tip (2.5, 0.5).
  // North at (2,0): body [2,3]×[-2,0] (centred on (2.5,-1)), input stub tip
  // (2.5, 0.5).
  // The stubs share [2,2.5]×[0,0.5]: stub-on-stub, not stub-on-body.
  it('canEnd() is true when perpendicular NOT gates meet only at stub ends', () => {
    const existing = makeNot(Direction.E);
    existing.position.set(0, 0);
    project.addComponent(existing);

    TestBed.inject(WorkModeService).setPlacementDirection(
      notComponentConfig.type,
      Direction.N
    );
    placeConfig = notComponentConfig as unknown as ComponentConfig<
      Record<string, ComponentOption>
    >;
    session = new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(2.5, -1),
      placeConfig
    );
    expect(session.canEnd()).toBe(true);
  });

  // North at (2,1) has body [2,3]×[-1,1] (centred on (2.5,0)); the East output
  // stub [2,2.5]×[0,1] extends into it, which is a real collision.
  it('canEnd() is false when perpendicular NOT gate output stub enters existing body', () => {
    const existing = makeNot(Direction.E);
    existing.position.set(0, 0);
    project.addComponent(existing);

    TestBed.inject(WorkModeService).setPlacementDirection(
      notComponentConfig.type,
      Direction.N
    );
    placeConfig = notComponentConfig as unknown as ComponentConfig<
      Record<string, ComponentOption>
    >;
    session = new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(2.5, 0),
      placeConfig
    );
    expect(session.canEnd()).toBe(false);
  });

  it('TEXT under a wire: canEnd() is true (ignoresWireCollision)', () => {
    // The TEXT body at (1,0) sits inside the wire.
    const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 5);
    project.addWire(wire);
    placeConfig = textComponentConfig as unknown as ComponentConfig<
      Record<string, ComponentOption>
    >;
    session = new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(1.5, 0.5),
      placeConfig
    );
    expect(session.canEnd()).toBe(true);
    wire.destroy();
  });

  it('TEXT on top of existing component: canEnd() is false (body-body collision)', () => {
    const existing = makeNot();
    existing.position.set(1, 0);
    project.addComponent(existing);
    placeConfig = textComponentConfig as unknown as ComponentConfig<
      Record<string, ComponentOption>
    >;
    session = new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(1.5, 0.5),
      placeConfig
    );
    expect(session.canEnd()).toBe(false);
  });

  // The nearest a snapped body can get: its centre within half a cell.
  const expectBodyCentredOn = (component: Component, cursor: Point) => {
    const body = component.bodyGridBounds;
    expect(Math.abs(body.x + body.width / 2 - cursor.x)).toBeLessThanOrEqual(
      0.5
    );
    expect(Math.abs(body.y + body.height / 2 - cursor.y)).toBeLessThanOrEqual(
      0.5
    );
  };

  it('centres the placed body under the cursor in every direction', () => {
    placeConfig = notComponentConfig as unknown as ComponentConfig<
      Record<string, ComponentOption>
    >;
    const workMode = TestBed.inject(WorkModeService);
    const directions = [Direction.E, Direction.S, Direction.W, Direction.N];
    // Off the lattice, and apart so the gates never touch.
    const cursors = directions.map((_, i) => new Point(10.2 + i * 10, -3.7));
    directions.forEach((direction, i) => {
      workMode.setPlacementDirection(placeConfig.type, direction);
      const placing = new ComponentPlacementSession(
        project,
        dragLayer,
        new Point(0, 0),
        placeConfig
      );
      placing.onMove(makeMoveInput(cursors[i].x, cursors[i].y));
      placing.onEnd();
    });

    const placed = [...project.components];
    expect(placed.map((c) => c.direction)).toEqual(directions);
    placed.forEach((component, i) => {
      expect(Number.isInteger(component.position.x)).toBe(true);
      expect(Number.isInteger(component.position.y)).toBe(true);
      expectBodyCentredOn(component, cursors[i]);
    });
  });

  it('a mid-drag rotate turns the ghost about the cursor', () => {
    placeConfig = notComponentConfig as unknown as ComponentConfig<
      Record<string, ComponentOption>
    >;
    const cursor = new Point(7.5, 4);
    session = new ComponentPlacementSession(
      project,
      dragLayer,
      cursor,
      placeConfig
    );
    session.rotate(1);
    session.onEnd();

    const [placed] = [...project.components];
    expect(placed.direction).toBe(Direction.S);
    expectBodyCentredOn(placed, cursor);
  });

  it('undo of a placement-with-split restores the original wire', () => {
    const v = new Wire(WireDirection.VERTICAL, 5);
    v.position.set(3.5, -2.5);
    project.addWire(v);

    session = new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(5, 1),
      placeConfig
    );
    session.onEnd();

    project.actionManager.undo();

    const huge = new Rectangle(-100, -100, 200, 200);
    const wires = project.queryWiresInRange(huge);
    expect(wires.length).toBe(1);
    expect(wires[0].length).toBe(5);
  });
});

describe('ComponentPlacementSession custom masters', () => {
  let project: Project;
  let dragLayer: Container<Component | Wire>;
  let registry: CustomComponentRegistry;
  let masterConfig: ComponentConfig;
  let workMode: WorkModeService;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
    dragLayer = new Container<Component | Wire>();
    registry = TestBed.inject(CustomComponentRegistry);
    workMode = TestBed.inject(WorkModeService);
    const masterTypeId = registry.createMaster(
      { id: 'master', symbol: 'S', numInputs: 2, numOutputs: 1 },
      'browser'
    );
    masterConfig = TestBed.inject(ComponentProviderService).getComponent(
      masterTypeId
    )! as unknown as ComponentConfig;
  });

  afterEach(() => {
    dragLayer.destroy();
    project.destroy({ children: true });
  });

  const placedComponents = () => [...project.components];

  it('commits a frozen snapshot wearing the placement direction', () => {
    // What the settings panel writes while a custom placement is armed.
    workMode.setPlacementDirection(masterConfig.type, Direction.N);

    new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(0, 0),
      masterConfig
    ).onEnd();

    const placed = placedComponents();
    expect(placed).toHaveLength(1);
    expect(placed[0].direction).toBe(Direction.N);
    // The instance wraps a snapshot of the master, not the master itself.
    expect(placed[0].config.type).not.toBe(masterConfig.type);
    expect(registry.getDefinition(placed[0].config.type)?.kind).toBe(
      'snapshot'
    );
  });

  it('freezes the ghost where it was dropped', () => {
    const session = new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(0, 0),
      masterConfig
    );
    // The 3×2 body centred on (6.5, 4) puts the component at (5, 3).
    session.onMove(makeMoveInput(6.5, 4));
    session.onEnd();

    const placed = placedComponents();
    expect(placed).toHaveLength(1);
    expect(placed[0].position).toMatchObject({ x: 5, y: 3 });
  });

  it('a mid-drag rotate turns the committed instance and sticks for the next one', () => {
    const session = new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(0, 0),
      masterConfig
    );
    session.rotate(1);
    session.onEnd();

    expect(placedComponents()[0].direction).toBe(Direction.S);
    expect(workMode.placementDirectionFor(masterConfig.type)).toBe(Direction.S);

    new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(0, 10),
      masterConfig
    ).onEnd();

    expect(placedComponents()[1].direction).toBe(Direction.S);
  });

  it('undo and redo round-trip the frozen instance', () => {
    workMode.setPlacementDirection(masterConfig.type, Direction.W);
    // Facing West, the body at (4,2) is [1,4]×[0,2], centred on (2.5, 1).
    new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(2.5, 1),
      masterConfig
    ).onEnd();
    const typeId = placedComponents()[0].config.type;

    project.actionManager.undo();
    expect(placedComponents()).toHaveLength(0);

    project.actionManager.redo();
    const restored = placedComponents();
    expect(restored).toHaveLength(1);
    expect(restored[0].config.type).toBe(typeId);
    expect(restored[0].direction).toBe(Direction.W);
    expect(restored[0].position).toMatchObject({ x: 4, y: 2 });
  });
});
