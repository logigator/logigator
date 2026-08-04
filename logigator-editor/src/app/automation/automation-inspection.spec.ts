import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import 'pixi.js/math-extras';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Point } from 'pixi.js';
import { configureTestBed } from '../../testing/configure-test-bed';
import { makeAnd, makeRom, makeSwitch } from '../../testing/factories';
import {
  FakeSimulationWorker,
  ManualFrameScheduler
} from '../../testing/fake-simulation-worker';
import { setStaticDIInjector } from '../utils/get-di';
import { InspectionService } from '../inspection/inspection.service';
import { EditorSettingsService } from '../settings/editor-settings.service';
import { Project } from '../project/project';
import { ProjectService } from '../project/project.service';
import { SimulationService } from '../simulation/simulation.service';
import {
  FRAME_SCHEDULER,
  SIMULATION_WORKER_FACTORY
} from '../simulation/worker/simulation-worker.service';
import { Component } from '../components/component';
import { ComponentProviderService } from '../components/component-provider.service';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { SubCircuitWatch } from '../components/custom/sub-circuit-watch';
import { outputComponentConfig } from '../components/component-types/output/output.config';
import { RomComponent } from '../components/component-types/rom/rom.component';
import { Wire } from '../wires/wire';
import { WireDirection } from '../wires/wire-direction.enum';
import { AutomationApiService } from './automation-api.service';

describe('AutomationApiService inspection', () => {
  let api: AutomationApiService;
  let simulation: SimulationService;
  let project: Project;
  let rom: RomComponent;

  beforeEach(async () => {
    configureTestBed([
      {
        provide: SIMULATION_WORKER_FACTORY,
        useValue: () => new FakeSimulationWorker().asWorker()
      },
      { provide: FRAME_SCHEDULER, useValue: new ManualFrameScheduler() }
    ]);
    setStaticDIInjector(TestBed.inject(Injector));
    api = TestBed.inject(AutomationApiService);
    simulation = TestBed.inject(SimulationService);
    TestBed.inject(EditorSettingsService).autoStartSimulation.set(false);
    project = new Project();
    TestBed.inject(ProjectService).setMainProject(project);

    rom = makeRom(2, 4);
    project.addComponent(rom);
  });

  afterEach(() => {
    TestBed.inject(InspectionService).closeAll();
    simulation.exit();
    project.destroy({ children: true });
  });

  it('opens a component’s inspection and addresses it by handle', async () => {
    await api.simEnter();

    const info = api.inspectOpen(rom.id);

    expect(info).toMatchObject({
      componentId: rom.id,
      componentType: rom.config.type,
      kind: 'rom'
    });
    // Not windowed in a bare TestBed — no outlet renders the chrome.
    expect(info.bounds).toBeNull();
    expect(api.inspectList()).toEqual([info]);
  });

  it('a second open focuses the existing view instead of stacking one', async () => {
    await api.simEnter();

    const first = api.inspectOpen(rom.id);
    const second = api.inspectOpen(rom.id);

    expect(second.id).toBe(first.id);
    expect(api.inspectList()).toHaveLength(1);
  });

  it('closing invalidates the handle', async () => {
    await api.simEnter();
    const info = api.inspectOpen(rom.id);

    api.inspectClose(info.id);

    expect(api.inspectList()).toEqual([]);
    expect(() => api.inspectClose(info.id)).toThrow(/no open inspection/);
    // A view opened afterwards gets its own handle, never the retired one.
    expect(api.inspectOpen(rom.id).id).not.toBe(info.id);
  });

  it('refuses the watch-only calls on a data inspection', async () => {
    await api.simEnter();
    const info = api.inspectOpen(rom.id);

    expect(() => api.inspectGetElements(info.id)).toThrow(/not a sub-circuit/);
    expect(() => api.inspectNavigateTo(info.id, 0)).toThrow(
      /not a sub-circuit/
    );
  });

  it('refuses a component that has no inspection, and any before entering', async () => {
    const and = makeAnd(2, undefined, 8, 8);
    project.addComponent(and);

    expect(() => api.inspectOpen(rom.id)).toThrow(/simulation/);

    await api.simEnter();
    expect(() => api.inspectOpen(and.id)).toThrow(/not inspectable/);
    expect(() => api.inspectOpen(999999)).toThrow(/no component/);
  });

  describe('sub-circuit watch', () => {
    let registry: CustomComponentRegistry;
    let provider: ComponentProviderService;

    beforeEach(() => {
      registry = TestBed.inject(CustomComponentRegistry);
      provider = TestBed.inject(ComponentProviderService);
      // The ROM is the other suite's subject; a watch scene stands alone.
      project.removeComponent(rom.id);
    });

    /** Wire spanning two half-grid termination points (axis-aligned). */
    function wireBetween(a: Point, b: Point): Wire {
      const horizontal = a.y === b.y;
      const wire = new Wire(
        horizontal ? WireDirection.HORIZONTAL : WireDirection.VERTICAL,
        horizontal ? Math.abs(b.x - a.x) : Math.abs(b.y - a.y)
      );
      wire.position.set(Math.min(a.x, b.x), Math.min(a.y, b.y));
      return wire;
    }

    /**
     * A one-output custom: `driver` (whatever produces the signal) wired to an
     * OUTPUT plug. Registered as a frozen snapshot, the way a placed instance
     * carries its definition.
     */
    function registerBox(
      name: string,
      symbol: string,
      driver: Component
    ): number {
      driver.position.set(0, 0);
      const plug = Component.deserialize(
        { pos: [8, 0], options: { label: '', index: 0 } },
        outputComponentConfig
      );
      const wire = wireBetween(
        driver.connectionPoints[driver.numInputs],
        plug.connectionPoints[0]
      );
      const body = (component: Component) => {
        const serialized = Component.serialize(component);
        return {
          type: serialized.type,
          pos: serialized.pos,
          ...(serialized.direction ? { direction: serialized.direction } : {}),
          options: serialized.options
        };
      };
      const serializedWire = Wire.serialize(wire);
      const circuit = {
        components: [body(driver), body(plug)],
        wires: [
          {
            pos: serializedWire.pos,
            direction: serializedWire.direction,
            length: serializedWire.length
          }
        ]
      };
      driver.destroy({ children: true });
      plug.destroy({ children: true });
      wire.destroy();
      return registry.registerSnapshot({
        kind: 'snapshot',
        source: 'browser',
        name,
        symbol,
        description: '',
        numInputs: 0,
        numOutputs: 1,
        labels: ['O'],
        circuit
      });
    }

    function place(typeId: number, target: Project): Component {
      const instance = Component.deserialize(
        { pos: [0, 0], options: {} },
        provider.getComponent(typeId)!
      );
      target.addComponent(instance);
      return instance;
    }

    /** Outer(Inner(switch)) placed on the board — two levels to drill through. */
    async function openNestedWatch(): Promise<number> {
      const inner = registerBox('Inner', 'IN', makeSwitch());
      const outerHost = new Project();
      const outer = registerBox('Outer', 'OUT', place(inner, outerHost));
      outerHost.destroy({ children: true });
      const instance = place(outer, project);

      await api.simEnter();
      return api.inspectOpen(instance.id).id;
    }

    it('opens a watch on the instance’s inner circuit', async () => {
      const id = await openNestedWatch();

      const info = api.inspectList()[0];
      expect(info).toMatchObject({ id, kind: 'watch', trail: ['Outer'] });
      // The level is a fresh copy, so its elements carry the copy's own ids.
      const inside = api.inspectGetElements(id).components;
      expect(inside).toHaveLength(2);
      expect(
        inside.some((component) => component.id === info.componentId)
      ).toBe(false);
    });

    it('drills into a nested custom and navigates back out', async () => {
      const id = await openNestedWatch();
      const before = api.inspectGetElements(id);
      const nested = before.components.find(
        (component) => component.type >= 1000
      )!;

      const drilled = api.inspectActivate(id, nested.id);

      expect(drilled.trail).toEqual(['Outer', 'Inner']);
      expect(drilled.title).toBe('Outer › Inner');
      // The visible level is a different circuit: the switch inside Inner.
      const inside = api.inspectGetElements(id);
      expect(inside.components.map((c) => c.type)).not.toEqual(
        before.components.map((c) => c.type)
      );

      expect(api.inspectNavigateTo(id, 0).trail).toEqual(['Outer']);
      expect(api.inspectGetElements(id).components.map((c) => c.type)).toEqual(
        before.components.map((c) => c.type)
      );
    });

    it('moves the visible level’s camera, taking the one-time fit’s turn', async () => {
      const id = await openNestedWatch();
      const watch = TestBed.inject(InspectionService).open()[0]
        .inspection as SubCircuitWatch;
      const { camera } = api.buildApi().inspect;

      camera.setZoom(id, 2);
      camera.setCenter(id, { x: 4, y: 3 });

      const view = camera.getViewport(id).view;
      expect(camera.getViewport(id).zoom).toBeCloseTo(2, 5);
      expect(view.x + view.width / 2).toBeCloseTo(4, 5);
      // The renderer fits a level the first time it shows; a placement takes
      // that turn, so it is not overwritten on the level's first frame.
      expect(watch.levels()[0].needsFit).toBe(false);
    });

    it('refuses a component that is not in the visible level', async () => {
      const id = await openNestedWatch();
      expect(() => api.inspectActivate(id, 999999)).toThrow(/visible level/);
    });
  });
});
