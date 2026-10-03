import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Point } from 'pixi.js';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { makeLed, makeSwitch } from '../../../testing/factories';
import {
  FakeSimulationWorker,
  ManualFrameScheduler
} from '../../../testing/fake-simulation-worker';
import { Component } from '../../components/component';
import { ComponentProviderService } from '../../components/component-provider.service';
import { SwitchComponent } from '../../components/component-types/switch/switch.component';
import { outputComponentConfig } from '../../components/component-types/output/output.config';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { Project } from '../../project/project';
import { ProjectService } from '../../project/project.service';
import { EditorSettingsService } from '../../settings/editor-settings.service';
import { SimulationService } from '../../simulation/simulation.service';
import { packSnapshot } from '../../simulation/worker/protocol';
import {
  FRAME_SCHEDULER,
  SIMULATION_WORKER_FACTORY
} from '../../simulation/worker/simulation-worker.service';
import { Wire } from '../../wires/wire';
import { WireDirection } from '@logigator/core';
import { WatchSession } from './watch-session';

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

describe('WatchSession', () => {
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

  /**
   * Snapshot with a switch driving its single output plug, plus a stray LED
   * whose input carries a negation bubble.
   */
  function registerSwitchBox(): number {
    const switchComp = makeSwitch(0, 0);
    const led = makeLed(4, 4);
    led.setPortNegated('in', 0, true);
    const plug = Component.deserialize(
      { pos: [8, 0], options: { label: '', index: 0 } },
      outputComponentConfig
    );
    const wire = wireBetween(
      switchComp.connectionPoints[0],
      plug.connectionPoints[0]
    );
    const serialize = (c: Component) => {
      const s = Component.serialize(c);
      return {
        type: s.type,
        pos: s.pos,
        ...(s.direction ? { direction: s.direction } : {}),
        ...(s.negInputs ? { negInputs: s.negInputs } : {}),
        options: s.options
      };
    };
    const w = Wire.serialize(wire);
    const circuit = {
      components: [serialize(switchComp), serialize(plug), serialize(led)],
      wires: [{ pos: w.pos, direction: w.direction, length: w.length }]
    };
    switchComp.destroy({ children: true });
    plug.destroy({ children: true });
    led.destroy({ children: true });
    wire.destroy();
    return registry.registerSnapshot({
      kind: 'snapshot',
      source: 'browser',
      name: 'SwitchBox',
      symbol: 'LB',
      description: '',
      numInputs: 0,
      numOutputs: 1,
      labels: ['O'],
      circuit
    });
  }

  async function enterWithInstance(): Promise<{ instanceId: number }> {
    const switchBox = registerSwitchBox();
    const config = provider.getComponent(switchBox)!;
    const instance = Component.deserialize(
      { pos: [0, 0], options: {} },
      config
    );
    project.addComponent(instance);
    simulation.enter();
    await vi.waitFor(() => expect(simulation.state()).toBe('ready'));
    return { instanceId: instance.id };
  }

  function openSession(instanceId: number): WatchSession {
    const board = simulation.board!;
    const info = board.watch.infoFor(String(instanceId))!;
    const definition = registry.getDefinition(info.typeId)!;
    return new WatchSession(definition.circuit!, info, board.descriptor.links);
  }

  /** Full-snapshot bits with exactly the given links powered. */
  function fullBits(links: number, powered: number[]): Uint8Array {
    const bits = new Uint8Array((links + 7) >> 3);
    for (const link of powered) {
      bits[link >> 3] |= 1 << (link & 7);
    }
    return bits;
  }

  it('requests a full seed snapshot on open', async () => {
    const { instanceId } = await enterWithInstance();

    const session = openSession(instanceId);

    const requests = fakeWorker.postedOfKind('requestSnapshot');
    expect(requests).toHaveLength(1);
    expect(requests[0].full).toBe(true);
    session.destroy();
  });

  it('lights the fresh copy from snapshots and syncs the switch pose', async () => {
    const { instanceId } = await enterWithInstance();
    const session = openSession(instanceId);
    const copiedWire = session.wires[0];
    const copiedSwitch = session.components[0] as SwitchComponent;
    const setPowered = vi.spyOn(copiedWire, 'setPowered');

    // The board's only unit is the inner switch.
    const switchLink = simulation.board!.descriptor.components[0].outputs[0];
    fakeWorker.emit({
      kind: 'snapshot',
      reqId: 99,
      tick: 1,
      isDelta: false,
      ...packSnapshot(
        undefined,
        null,
        fullBits(simulation.board!.descriptor.links, [switchLink])
      )
    });

    expect(setPowered).toHaveBeenCalledWith(true);
    // The first frame after the seed poses the switch.
    expect(session.onFrame()).toBe(true);
    expect(copiedSwitch.isOn).toBe(true);
    // Nothing changed since.
    expect(session.onFrame()).toBe(false);
    session.destroy();
  });

  it('opens its copies inside the session, so a negated display inverts', async () => {
    // The copies are built after enter(), so its setSimulating pass never
    // walked them.
    const { instanceId } = await enterWithInstance();
    const session = openSession(instanceId);

    const led = session.components[2];
    expect(led.isPortNegated('in', 0)).toBe(true);
    expect(led.isInputHigh(0)).toBe(true);
    session.destroy();
  });

  it('stops receiving snapshots after destroy', async () => {
    const { instanceId } = await enterWithInstance();
    const session = openSession(instanceId);
    const setPowered = vi.spyOn(session.wires[0], 'setPowered');

    session.destroy();
    const switchLink = simulation.board!.descriptor.components[0].outputs[0];
    fakeWorker.emit({
      kind: 'snapshot',
      reqId: 99,
      tick: 1,
      isDelta: false,
      ...packSnapshot(
        undefined,
        null,
        fullBits(simulation.board!.descriptor.links, [switchLink])
      )
    });

    expect(setPowered).not.toHaveBeenCalled();
  });

  it('fails loudly when the body shape disagrees with the index tables', async () => {
    const { instanceId } = await enterWithInstance();
    const board = simulation.board!;
    const info = board.watch.infoFor(String(instanceId))!;
    const definition = registry.getDefinition(info.typeId)!;
    const mutilated = {
      components: definition.circuit!.components,
      wires: []
    };

    expect(
      () => new WatchSession(mutilated, info, board.descriptor.links)
    ).toThrow(/does not match/);
  });
});
