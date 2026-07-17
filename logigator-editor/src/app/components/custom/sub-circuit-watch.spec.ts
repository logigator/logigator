import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Point } from 'pixi.js';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { makeSwitch } from '../../../testing/factories';
import {
  FakeSimulationWorker,
  ManualFrameScheduler
} from '../../../testing/fake-simulation-worker';
import { Component } from '../component';
import { ComponentProviderService } from '../component-provider.service';
import { SwitchComponent } from '../component-types/switch/switch.component';
import { outputComponentConfig } from '../component-types/output/output.config';
import { Project } from '../../project/project';
import { ProjectService } from '../../project/project.service';
import { EditorSettingsService } from '../../settings/editor-settings.service';
import { SimulationService } from '../../simulation/simulation.service';
import {
  FRAME_SCHEDULER,
  SIMULATION_WORKER_FACTORY
} from '../../simulation/worker/simulation-worker.service';
import { Wire } from '../../wires/wire';
import { WireDirection } from '../../wires/wire-direction.enum';
import { CustomComponentRegistry } from './custom-component-registry.service';
import { CustomComponent } from './custom-component';
import { SubCircuitWatch } from './sub-circuit-watch';

/** Wire spanning the two given half-grid termination points (axis-aligned). */
function wireBetween(a: Point, b: Point): Wire {
  const horizontal = a.y === b.y;
  const wire = new Wire(
    horizontal ? WireDirection.HORIZONTAL : WireDirection.VERTICAL,
    horizontal ? Math.abs(b.x - a.x) : Math.abs(b.y - a.y)
  );
  wire.position.set(Math.min(a.x, b.x), Math.min(a.y, b.y));
  return wire;
}

function serializeBody(components: Component[], wires: Wire[]) {
  const body = {
    components: components.map((c) => {
      const s = Component.serialize(c);
      return {
        type: s.type,
        pos: s.pos,
        ...(s.direction ? { direction: s.direction } : {}),
        options: s.options
      };
    }),
    wires: wires.map((w) => {
      const s = Wire.serialize(w);
      return { pos: s.pos, direction: s.direction, length: s.length };
    })
  };
  components.forEach((c) => c.destroy({ children: true }));
  wires.forEach((w) => w.destroy());
  return body;
}

describe('SubCircuitWatch', () => {
  let simulation: SimulationService;
  let registry: CustomComponentRegistry;
  let provider: ComponentProviderService;
  let project: Project;
  let fakeWorker: FakeSimulationWorker;

  beforeEach(() => {
    configureTestBed([
      {
        provide: SIMULATION_WORKER_FACTORY,
        useValue: () => {
          fakeWorker = new FakeSimulationWorker();
          return fakeWorker.asWorker();
        }
      },
      { provide: FRAME_SCHEDULER, useValue: new ManualFrameScheduler() }
    ]);
    simulation = TestBed.inject(SimulationService);
    registry = TestBed.inject(CustomComponentRegistry);
    provider = TestBed.inject(ComponentProviderService);
    // Keep the boot paused so the watch is set up before the run advances.
    TestBed.inject(EditorSettingsService).autoStartSimulation.set(false);
    project = new Project();
    TestBed.inject(ProjectService).setMainProject(project);
  });

  afterEach(() => {
    simulation.exit();
    project.destroy({ children: true });
  });

  /** SwitchBox nested inside Outer; a placed Outer instance in the project. */
  async function placeNestedFixture(): Promise<CustomComponent> {
    const switchComp = makeSwitch(0, 0);
    const plug = Component.deserialize(
      { pos: [8, 0], options: { label: '', index: 0 } },
      outputComponentConfig
    );
    const switchBox = registry.registerSnapshot({
      kind: 'snapshot',
      source: 'browser',
      name: 'SwitchBox',
      symbol: 'LB',
      description: '',
      numInputs: 0,
      numOutputs: 1,
      labels: ['O'],
      circuit: serializeBody(
        [switchComp, plug],
        [wireBetween(switchComp.connectionPoints[0], plug.connectionPoints[0])]
      )
    });

    const inner = Component.deserialize(
      { pos: [0, 0], options: {} },
      provider.getComponent(switchBox)!
    );
    const outerPlug = Component.deserialize(
      { pos: [10, 0], options: { label: '', index: 0 } },
      outputComponentConfig
    );
    const outer = registry.registerSnapshot({
      kind: 'snapshot',
      source: 'browser',
      name: 'Outer',
      symbol: 'OU',
      description: '',
      numInputs: 0,
      numOutputs: 1,
      labels: ['O'],
      circuit: serializeBody(
        [inner, outerPlug],
        [wireBetween(inner.connectionPoints[0], outerPlug.connectionPoints[0])]
      )
    });

    const instance = Component.deserialize(
      { pos: [0, 0], options: {} },
      provider.getComponent(outer)!
    ) as CustomComponent;
    project.addComponent(instance);
    simulation.enter();
    await vi.waitFor(() => expect(simulation.state()).toBe('ready'));
    return instance;
  }

  it('drills into a nested custom and navigates back, destroying the level', async () => {
    const instance = await placeNestedFixture();
    const watch = instance.config.inspection!(instance) as SubCircuitWatch;

    expect(watch.levels()).toHaveLength(1);
    expect(watch.title()).toBe('Outer');

    // Body index 0 of Outer is the SwitchBox copy.
    const innerCopy = watch.activeLevel().session.components[0];
    watch.activate(innerCopy);

    expect(watch.levels()).toHaveLength(2);
    expect(watch.title()).toBe('Outer › SwitchBox');
    const deepProject = watch.activeLevel().session.project;

    // Header breadcrumbs: the ancestor navigates, the visible level doesn't.
    const parts = watch.titleParts();
    expect(parts.map((part) => part.label)).toEqual(['Outer', 'SwitchBox']);
    expect(parts[1].navigate).toBeUndefined();
    parts[0].navigate!();

    expect(watch.levels()).toHaveLength(1);
    expect(watch.title()).toBe('Outer');
    expect(watch.titleParts()).toHaveLength(1);
    expect(deepProject.destroyed).toBe(true);

    watch.destroy();
  });

  it('routes an inner switch click to its flattened engine unit', async () => {
    const instance = await placeNestedFixture();
    const watch = instance.config.inspection!(instance) as SubCircuitWatch;
    watch.activate(watch.activeLevel().session.components[0]);

    const switchCopy = watch.activeLevel().session.components[0];
    expect(switchCopy).toBeInstanceOf(SwitchComponent);
    watch.activate(switchCopy);

    expect((switchCopy as SwitchComponent).isOn).toBe(true);
    const inputs = fakeWorker.postedOfKind('triggerInput');
    expect(inputs).toHaveLength(1);
    // The flattened board's only unit is the inner switch — index 0.
    expect(inputs[0]).toMatchObject({
      componentIndex: 0,
      event: 0,
      state: [true]
    });

    watch.destroy();
  });
});
