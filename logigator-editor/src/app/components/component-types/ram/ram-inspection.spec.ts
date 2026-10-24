import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Point } from 'pixi.js';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { makeInput, makeRam } from '../../../../testing/factories';
import {
  FakeSimulationWorker,
  ManualFrameScheduler
} from '../../../../testing/fake-simulation-worker';
import { FakeUserInput } from '../../../../testing/fake-user-input';
import {
  RamWrite,
  ramWriteFrames,
  ramWriteTicks
} from '../../../../testing/ram-writes';
import { Component } from '../../component';
import { ComponentProviderService } from '../../component-provider.service';
import { CustomComponentRegistry } from '../../custom/custom-component-registry.service';
import { SubCircuitWatch } from '../../custom/sub-circuit-watch';
import { InspectionService } from '../../../inspection/inspection.service';
import { EditorSettingsService } from '../../../settings/editor-settings.service';
import { Project } from '../../../project/project';
import { ProjectService } from '../../../project/project.service';
import { SimulationService } from '../../../simulation/simulation.service';
import {
  FRAME_SCHEDULER,
  SIMULATION_WORKER_FACTORY
} from '../../../simulation/worker/simulation-worker.service';
import {
  maxWord,
  packedByteLength,
  readWord
} from '../../../utils/packed-buffer';
import { RAM_WHOLE_READ_BYTES, RamInspection } from './ram-inspection';
import { RamComponent } from './ram.component';

/** Moves `component` so its port `port` lies on `target`. */
function placePortAt(component: Component, port: number, target: Point): void {
  const at = component.connectionPoints[port];
  component.position.set(
    component.position.x + target.x - at.x,
    component.position.y + target.y - at.y
  );
}

/**
 * A user input whose outputs touch the inputs of `target` one for one, so
 * output `i` drives input `i`.
 */
function drivingInput(target: Component): FakeUserInput {
  const input = new FakeUserInput(target.numInputs);
  placePortAt(input, 0, target.connectionPoints[0]);
  for (let pin = 0; pin < target.numInputs; pin++) {
    const from = input.connectionPoints[pin];
    const to = target.connectionPoints[pin];
    if (from.x !== to.x || from.y !== to.y) {
      throw new Error(`output ${pin} misses the input it should drive`);
    }
  }
  return input;
}

/** A `wordSize`-bit word for each address, none of them zero. */
function wordsFor(addresses: number[], wordSize: number): RamWrite[] {
  return addresses.map((address, i) => ({
    address,
    value: ((0x1b5dn * BigInt(i + 3)) & maxWord(wordSize)) | 1n
  }));
}

/** Every word of the inspection's memory, by address. */
function shownWords(inspection: RamInspection): bigint[] {
  return Array.from({ length: inspection.wordCount }, (_, address) =>
    readWord(inspection.bytes(), address, inspection.wordSize)
  );
}

/** A memory of `wordCount` zero words holding `writes`. */
function memoryOf(wordCount: number, writes: readonly RamWrite[]): bigint[] {
  const words = new Array<bigint>(wordCount).fill(0n);
  for (const { address, value } of writes) {
    words[address] = value;
  }
  return words;
}

/** The byte holding a word's first bit. */
const firstByteOf = (address: number, wordSize: number) =>
  Math.floor((address * wordSize) / 8);

describe('RamInspection', () => {
  let simulation: SimulationService;
  let inspections: InspectionService;
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
    inspections = TestBed.inject(InspectionService);
    TestBed.inject(EditorSettingsService).autoStartSimulation.set(false);
    project = new Project();
    TestBed.inject(ProjectService).setMainProject(project);
  });

  afterEach(() => {
    inspections.closeAll();
    simulation.exit();
    project.destroy({ children: true });
  });

  /** Lets every worker round trip in flight land. */
  const settle = () => new Promise((resolve) => setTimeout(resolve));

  /** The board RAM's engine unit in the session. */
  const ramUnit = () => [...simulation.board!.stateUnits.values()][0];

  async function boot(): Promise<void> {
    simulation.enter();
    await vi.waitFor(() => expect(simulation.state()).toBe('ready'));
  }

  /** A RAM on the board, every input driven by one user input. */
  function placeRam(
    addressSize: number,
    wordSize: number
  ): { ram: RamComponent; input: FakeUserInput } {
    const ram = makeRam(addressSize, wordSize, 10, 0);
    const input = drivingInput(ram);
    project.addComponent(ram);
    project.addComponent(input);
    return { ram, input };
  }

  function open(component: Component): RamInspection {
    inspections.openFor(component);
    const inspection = inspections.open().at(-1)!.inspection;
    expect(inspection).toBeInstanceOf(RamInspection);
    return inspection as RamInspection;
  }

  /**
   * Stores `writes` through `input` into the RAM of the inspection's shape
   * it drives, while paused, stepping until done.
   */
  async function store(
    input: FakeUserInput,
    shape: RamInspection,
    writes: readonly RamWrite[]
  ): Promise<void> {
    simulation.sendFrames(
      input.id,
      ramWriteFrames(Math.log2(shape.wordCount), shape.wordSize, writes)
    );
    for (let tick = 0; tick < ramWriteTicks(writes.length); tick++) {
      simulation.step();
    }
    await settle();
  }

  it.each([1, 7, 8, 13])(
    'shows exactly the words the circuit stored, %i-bit words',
    async (wordSize) => {
      const { ram, input } = placeRam(4, wordSize);
      await boot();
      const inspection = open(ram);
      inspection.showBytes({ start: 0, end: 1 });
      const writes = wordsFor([0, 3, 9, 15], wordSize);

      await store(input, inspection, writes);

      expect(shownWords(inspection)).toEqual(memoryOf(16, writes));
      expect(inspection.loaded()).toEqual({
        start: 0,
        end: packedByteLength(16, wordSize)
      });
    }
  );

  it('shows each write, and the worker sends nothing while no write changed a bit', async () => {
    const { ram, input } = placeRam(3, 8);
    await boot();
    const inspection = open(ram);
    inspection.showBytes({ start: 0, end: 8 });
    await settle();
    const reads = fakeWorker.stateReads().length;
    const snapshots = fakeWorker.snapshots.length;

    for (let tick = 0; tick < 4; tick++) {
      simulation.step();
      await settle();
    }
    expect(fakeWorker.snapshots.length).toBe(snapshots + 4);
    expect(fakeWorker.stateReads()).toHaveLength(reads);

    await store(input, inspection, [{ address: 6, value: 0xc3n }]);
    expect(fakeWorker.stateReads()).toHaveLength(reads + 1);
    expect(shownWords(inspection)).toEqual(
      memoryOf(8, [{ address: 6, value: 0xc3n }])
    );

    // The same word again leaves every stored bit as it was.
    await store(input, inspection, [{ address: 6, value: 0xc3n }]);
    expect(fakeWorker.stateReads()).toHaveLength(reads + 1);
  });

  it.each([7, 13])(
    'reads a large %i-bit memory around the rows on screen, moving the range as the view scrolls',
    async (wordSize) => {
      const addressSize = 13;
      const { ram, input } = placeRam(addressSize, wordSize);
      await boot();
      const size = packedByteLength(1 << addressSize, wordSize);
      expect(size).toBeGreaterThan(RAM_WHOLE_READ_BYTES);
      const inspection = open(ram);
      const near = wordsFor([5, 21], wordSize);
      const far = wordsFor([8000], wordSize);
      await store(input, inspection, [...near, ...far]);

      // A screen of 100 bytes reads as many again on either side.
      inspection.showBytes({ start: 0, end: 100 });
      await settle();
      expect(fakeWorker.postedOfKind('watchState').at(-1)!.watch).toMatchObject(
        { offset: 0, length: 200 }
      );
      expect(inspection.loaded()).toEqual({ start: 0, end: 200 });
      expect(shownWords(inspection)).toEqual(memoryOf(1 << addressSize, near));

      // Scrolling within the range read asks for nothing new.
      inspection.showBytes({ start: 60, end: 160 });
      expect(fakeWorker.postedOfKind('watchState')).toHaveLength(1);

      // A screen around the far word, its edges inside words.
      const farByte = firstByteOf(8000, wordSize);
      inspection.showBytes({ start: farByte - 37, end: farByte + 63 });
      await settle();
      const moved = { start: farByte - 137, end: farByte + 163 };
      expect(fakeWorker.postedOfKind('watchState').at(-1)!.watch).toMatchObject(
        { offset: moved.start, length: moved.end - moved.start }
      );
      expect(inspection.loaded()).toEqual(moved);
      expect(readWord(inspection.bytes(), 8000, wordSize)).toBe(far[0].value);
      expect(
        fakeWorker.engine.state(ramUnit()).subarray(moved.start, moved.end)
      ).toEqual(inspection.bytes().subarray(moved.start, moved.end));
    }
  );

  it('shows the memory all zero after a stop, the rebuilt engine sending nothing until written', async () => {
    const { ram, input } = placeRam(4, 7);
    await boot();
    const inspection = open(ram);
    inspection.showBytes({ start: 0, end: 4 });
    await store(input, inspection, wordsFor([1, 2], 7));
    const reads = fakeWorker.stateReads().length;

    simulation.stop();
    await settle();
    expect(shownWords(inspection)).toEqual(memoryOf(16, []));
    simulation.step();
    await settle();
    expect(fakeWorker.stateReads()).toHaveLength(reads);

    const after = [{ address: 12, value: 0x55n }];
    await store(input, inspection, after);
    expect(shownWords(inspection)).toEqual(memoryOf(16, after));
  });

  it('stops reading once closed, and once no view shows the memory', async () => {
    const { ram, input } = placeRam(4, 8);
    await boot();
    const inspection = open(ram);
    inspection.showBytes({ start: 0, end: 4 });
    await settle();

    inspection.showBytes(null);
    await store(input, inspection, wordsFor([4], 8));
    expect(fakeWorker.snapshots.at(-1)!.state).toBeUndefined();
    expect(shownWords(inspection)).toEqual(memoryOf(16, []));

    // Shown again, it reads what was stored meanwhile.
    inspection.showBytes({ start: 0, end: 4 });
    await settle();
    expect(shownWords(inspection)).toEqual(memoryOf(16, wordsFor([4], 8)));

    inspections.closeAll();
    const reads = fakeWorker.stateReads().length;
    await store(input, inspection, wordsFor([9], 8));
    expect(fakeWorker.stateReads()).toHaveLength(reads);
  });

  it('reads a RAM opened while the engine is still starting, once it is up', async () => {
    const { ram } = placeRam(2, 4);
    simulation.enter();
    expect(simulation.state()).toBe('starting');
    const inspection = open(ram);
    inspection.showBytes({ start: 0, end: 2 });

    await vi.waitFor(() => expect(simulation.state()).toBe('ready'));
    await settle();
    expect(inspection.loaded()).toEqual({ start: 0, end: 2 });
  });

  describe('inside a watch', () => {
    /**
     * A custom component holding a RAM whose inputs are its input plugs, one
     * for one, placed on the board with a user input driving every pin.
     */
    async function placeRamBox(
      addressSize: number,
      wordSize: number
    ): Promise<{ instance: Component; input: FakeUserInput }> {
      const registry = TestBed.inject(CustomComponentRegistry);
      const provider = TestBed.inject(ComponentProviderService);
      const inner = makeRam(addressSize, wordSize, 10, 0);
      const plugs = Array.from({ length: inner.numInputs }, (_, pin) => {
        const plug = makeInput(pin);
        placePortAt(plug, 0, inner.connectionPoints[pin]);
        return plug;
      });
      const components = [inner, ...plugs];
      const typeId = registry.registerSnapshot({
        kind: 'snapshot',
        source: 'browser',
        name: 'RamBox',
        symbol: 'RB',
        description: '',
        numInputs: plugs.length,
        numOutputs: 0,
        labels: plugs.map((_, pin) => `I${pin}`),
        circuit: {
          components: components.map((component) => {
            const { type, pos, options } = Component.serialize(component);
            return { type, pos, options };
          }),
          wires: []
        }
      });
      for (const component of components) component.destroy({ children: true });

      const instance = Component.deserialize(
        { pos: [10, 0], options: {} },
        provider.getComponent(typeId)!
      );
      const input = drivingInput(instance);
      project.addComponent(instance);
      project.addComponent(input);
      await boot();
      return { instance, input };
    }

    it('shows the words the inner RAM stored, read through the watch level', async () => {
      const { instance, input } = await placeRamBox(3, 13);
      inspections.openFor(instance);
      const watch = inspections.open()[0].inspection as SubCircuitWatch;
      const copy = watch.activeLevel().session.components[0];
      expect(copy).toBeInstanceOf(RamComponent);
      watch.activate(copy);
      const inspection = inspections.open().at(-1)!.inspection as RamInspection;
      expect(inspection).toBeInstanceOf(RamInspection);
      inspection.showBytes({ start: 0, end: 1 });
      await settle();
      expect(inspection.loaded()).toEqual({ start: 0, end: 13 });
      const writes = wordsFor([2, 7], 13);

      await store(input, inspection, writes);

      expect(shownWords(inspection)).toEqual(memoryOf(8, writes));
    });
  });
});
