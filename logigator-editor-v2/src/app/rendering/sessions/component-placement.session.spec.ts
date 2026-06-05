import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Container, FederatedPointerEvent, Point, Rectangle } from 'pixi.js';
import { setStaticDIInjector } from '../../utils/get-di';
import { Project } from '../../project/project';
import { Wire } from '../../wires/wire';
import { WireDirection } from '../../wires/wire-direction.enum';
import { AndComponent } from '../../components/component-types/and/and.component';
import { andComponentConfig } from '../../components/component-types/and/and.config';
import { NotComponent } from '../../components/component-types/not/not.component';
import { notComponentConfig } from '../../components/component-types/not/not.config';
import { textComponentConfig } from '../../components/component-types/text/text.config';
import { Direction } from '../../utils/direction';
import { Component } from '../../components/component';
import { ComponentConfig } from '../../components/component-config.model';
import { ComponentOption } from '../../components/component-option';
import { ComponentPlacementSession } from './component-placement.session';

// AND gate: bodyGridWidth=2, bodyGridHeight=max(inputs,1)=2 for 2-input gate.
// When dragLayer.position=(px,py): bodyBoundsWorld = Rectangle(px, py, 2, 2).
// gridBounds (with stubs): lx=-0.5, w=3 → Rectangle(px-0.5, py, 3, 2).

function makeWire(
  gx: number,
  gy: number,
  dir: WireDirection,
  length: number
): Wire {
  const w = new Wire(dir, length);
  w.position.set(gx + 0.5, gy + 0.5);
  return w;
}

function makeAnd(numInputs = 2): AndComponent {
  return new AndComponent({
    direction: andComponentConfig.options.direction.clone(),
    numInputs: andComponentConfig.options.numInputs.clone(numInputs)
  });
}

function makeNot(direction: Direction = Direction.E): NotComponent {
  return new NotComponent({
    direction: notComponentConfig.options.direction.clone(direction)
  });
}

function makeMoveEvent(x: number, y: number): FederatedPointerEvent {
  return {
    getLocalPosition: () => new Point(x, y)
  } as unknown as FederatedPointerEvent;
}

describe('ComponentPlacementSession collision', () => {
  let project: Project;
  let dragLayer: Container<Component | Wire>;
  let session: ComponentPlacementSession;

  beforeEach(() => {
    setStaticDIInjector(TestBed.inject(Injector));
    project = new Project();
    dragLayer = new Container<Component | Wire>();
    project.componentToPlace = andComponentConfig as unknown as ComponentConfig<
      Record<string, ComponentOption>
    >;
  });

  afterEach(() => {
    session?.onCancel();
    dragLayer.destroy();
    project.destroy({ children: true });
  });

  it('canEnd() is true when placed on empty ground', () => {
    session = new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(0, 0)
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
      new Point(0, 0)
    );
    expect(session.canEnd()).toBe(false);
  });

  it('canEnd() is false when body lands on a wire — catches missing wire check bug', () => {
    // Body at startPos=(5,0): Rectangle(5,0,2,2).
    // Wire gx=3, len=3: gridBounds=[3,7)×[0,1) → enters body at x=5.
    const wire = makeWire(3, 0, WireDirection.HORIZONTAL, 3);
    project.addWire(wire);
    session = new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(5, 0)
    );
    expect(session.canEnd()).toBe(false);
    wire.destroy();
  });

  it('canEnd() is true when wire ends at the stub boundary (not inside body)', () => {
    // Body at (5,0): Rectangle(5,0,2,2). Wire gx=0, len=4: gridBounds=[0,5)×[0,1).
    // Wire right=5 equals body left=5 → no intersection (touches but does not overlap).
    const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 4);
    project.addWire(wire);
    session = new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(5, 0)
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
      new Point(5, 0)
    );
    expect(session.canEnd()).toBe(false);

    session.onMove(makeMoveEvent(20, 0));
    expect(session.canEnd()).toBe(true);
    wire.destroy();
  });

  it('canEnd() sets to false after onMove moves body onto a wire', () => {
    const wire = makeWire(3, 0, WireDirection.HORIZONTAL, 3);
    project.addWire(wire);
    session = new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(0, 10)
    );
    expect(session.canEnd()).toBe(true);

    session.onMove(makeMoveEvent(5, 0));
    expect(session.canEnd()).toBe(false);
    wire.destroy();
  });

  it('placing a component whose port lands on a wire interior splits the wire', () => {
    // AND at (4, 0) facing East has input ports at (3.5, 0.5) and (3.5, 1.5).
    // V wire (3.5, -2.5)→(3.5, 2.5) passes through both ports in its interior
    // without overlapping the body (body x∈[4,6), wire gridBounds.right=4 — touch only).
    const v = new Wire(WireDirection.VERTICAL, 5);
    v.position.set(3.5, -2.5);
    project.addWire(v);

    session = new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(4, 0)
    );
    expect(session.canEnd()).toBe(true);
    session.onEnd();

    const huge = new Rectangle(-100, -100, 200, 200);
    const wires = Array.from(project.queryWiresInRange(huge));
    expect(wires.find((w) => w.id === v.id)).toBeUndefined();
    const verticals = wires.filter(
      (w) => w.direction === WireDirection.VERTICAL
    );
    // Two ports split V into three pieces.
    expect(verticals.length).toBe(3);
    const lengths = verticals.map((w) => w.length).sort();
    expect(lengths).toEqual([1, 1, 3]);
  });

  // NOT gate geometry (bodyGridWidth=2, bodyGridHeight=1, 1 input, 1 output):
  //   East at (0,0):  body [0,2]×[0,1],  output stub tip at (2.5, 0.5)
  //   North at (2,0): body [2,3]×[-2,0], input  stub tip at (2.5,  0.5)
  // The two stubs share the region [2,2.5]×[0,0.5] — stub-on-stub, not stub-on-body.
  it('canEnd() is true when perpendicular NOT gates meet only at stub ends', () => {
    const existing = makeNot(Direction.E);
    existing.position.set(0, 0);
    project.addComponent(existing);

    project.componentToPlace = {
      ...notComponentConfig,
      options: {
        direction: notComponentConfig.options.direction.clone(Direction.N)
      }
    } as unknown as ComponentConfig<Record<string, ComponentOption>>;
    session = new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(2, 0)
    );
    expect(session.canEnd()).toBe(true);
  });

  // North at (2,1): body [2,3]×[-1,1].  East output stub [2,2.5]×[0,1] extends
  // into that body — stub-in-body is a real collision.
  it('canEnd() is false when perpendicular NOT gate output stub enters existing body', () => {
    const existing = makeNot(Direction.E);
    existing.position.set(0, 0);
    project.addComponent(existing);

    project.componentToPlace = {
      ...notComponentConfig,
      options: {
        direction: notComponentConfig.options.direction.clone(Direction.N)
      }
    } as unknown as ComponentConfig<Record<string, ComponentOption>>;
    session = new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(2, 1)
    );
    expect(session.canEnd()).toBe(false);
  });

  it('TEXT under a wire: canEnd() is true (ignoresWireCollision)', () => {
    // Wire at (0,0) horizontal length 5. TEXT placed at (1,0) — body inside wire.
    const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 5);
    project.addWire(wire);
    project.componentToPlace =
      textComponentConfig as unknown as ComponentConfig<
        Record<string, ComponentOption>
      >;
    session = new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(1, 0)
    );
    expect(session.canEnd()).toBe(true);
    wire.destroy();
  });

  it('TEXT on top of existing component: canEnd() is false (body-body collision)', () => {
    const existing = makeNot();
    existing.position.set(1, 0);
    project.addComponent(existing);
    project.componentToPlace =
      textComponentConfig as unknown as ComponentConfig<
        Record<string, ComponentOption>
      >;
    session = new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(1, 0)
    );
    expect(session.canEnd()).toBe(false);
  });

  it('undo of a placement-with-split restores the original wire', () => {
    const v = new Wire(WireDirection.VERTICAL, 5);
    v.position.set(3.5, -2.5);
    project.addWire(v);

    session = new ComponentPlacementSession(
      project,
      dragLayer,
      new Point(4, 0)
    );
    session.onEnd();

    project.actionManager.undo();

    const huge = new Rectangle(-100, -100, 200, 200);
    const wires = Array.from(project.queryWiresInRange(huge));
    expect(wires.length).toBe(1);
    expect(wires[0].length).toBe(5);
  });
});
