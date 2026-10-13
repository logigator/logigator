import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GamepadControlId } from '@logigator/core';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { ManualFrameScheduler } from '../../../testing/fake-simulation-worker';
import { makeGamepad } from '../../../testing/factories';
import { InputRoute } from '../../components/component-inspection';
import { GamepadComponent } from '../../components/component-types/gamepad/gamepad.component';
import { GamepadInspection } from '../../components/component-types/gamepad/gamepad-inspection';
import { SimulationService } from '../../simulation/simulation.service';
import { FRAME_SCHEDULER } from '../../simulation/worker/simulation-worker.service';
import {
  GamepadHardwareService,
  GamepadPadTarget,
  GamepadReading
} from './gamepad-hardware.service';

/** A mutable stand-in for a browser `Gamepad`, at rest. */
interface FakePad extends GamepadReading {
  buttons: { pressed: boolean; value: number }[];
  axes: number[];
}

function fakePad(
  index: number,
  mapping: GamepadMappingType = 'standard'
): FakePad {
  return {
    index,
    id: `Pad ${index} (STANDARD GAMEPAD Vendor: 045e Product: 0b13)`,
    mapping,
    connected: true,
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    axes: [0, 0, 0, 0]
  };
}

function setButton(pad: FakePad, index: number, pressed: boolean): void {
  pad.buttons[index] = { pressed, value: pressed ? 1 : 0 };
}

/** A gamepad window's inspection over a route that records slot presses. */
function playedPad(options: Parameters<typeof makeGamepad>[0] = {}): {
  pad: GamepadComponent;
  inspection: GamepadInspection;
  calls: string[];
} {
  const pad = makeGamepad(options);
  const calls: string[] = [];
  const route: InputRoute = {
    press: (slot) => {
      calls.push(`press ${pad.slotIds[slot]}`);
      pad.setActive(slot, true);
    },
    release: (slot) => {
      calls.push(`release ${pad.slotIds[slot]}`);
      pad.setActive(slot, false);
    },
    send: () => undefined,
    cancel: () => undefined,
    pending: () => 0
  };
  return { pad, inspection: new GamepadInspection(pad, route), calls };
}

/** A target that records what reaches it. */
class RecordingTarget implements GamepadPadTarget {
  public readonly calls: string[] = [];

  padDown(control: GamepadControlId, input: string): void {
    this.calls.push(`down ${control} ${input}`);
  }

  padUp(control: GamepadControlId, input: string): void {
    this.calls.push(`up ${control} ${input}`);
  }

  releasePad(): void {
    this.calls.push('release');
  }
}

describe('GamepadHardwareService', () => {
  let pads: (FakePad | null)[];
  let getGamepads: Mock<() => (FakePad | null)[]>;
  let ready: WritableSignal<boolean>;
  let frames: ManualFrameScheduler;
  let service: GamepadHardwareService;
  const disposers: (() => void)[] = [];
  const components: GamepadComponent[] = [];

  function connect(pad: FakePad): void {
    pads[pad.index] = pad;
    window.dispatchEvent(new Event('gamepadconnected'));
  }

  function disconnect(index: number): void {
    pads[index] = null;
    window.dispatchEvent(
      Object.assign(new Event('gamepaddisconnected'), { gamepad: { index } })
    );
  }

  function register(target: GamepadPadTarget): void {
    disposers.push(service.register(target));
  }

  function played(
    options: Parameters<typeof makeGamepad>[0] = {}
  ): ReturnType<typeof playedPad> {
    const result = playedPad(options);
    components.push(result.pad);
    // An open inspection is a target until it closes.
    disposers.push(() => result.inspection.destroy());
    return result;
  }

  function setVisibility(state: DocumentVisibilityState): void {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => state
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  beforeEach(() => {
    pads = [];
    getGamepads = vi.fn(() => pads);
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: getGamepads
    });
    ready = signal(true);
    frames = new ManualFrameScheduler();
    configureTestBed([
      { provide: SimulationService, useValue: { isReady: ready } },
      { provide: FRAME_SCHEDULER, useValue: frames }
    ]);
    service = TestBed.inject(GamepadHardwareService);
  });

  afterEach(() => {
    for (const dispose of disposers.splice(0)) dispose();
    for (const pad of components.splice(0)) pad.destroy({ children: true });
    TestBed.resetTestingModule();
    delete (navigator as { getGamepads?: unknown }).getGamepads;
    delete (document as { visibilityState?: unknown }).visibilityState;
  });

  it('keeps up held while the D-pad or the stick holds it, releasing once both let go', () => {
    const controller = fakePad(0);
    pads[0] = controller;
    const { inspection, calls } = played();

    setButton(controller, 12, true);
    frames.fire();
    controller.axes[1] = -1;
    frames.fire();
    expect(calls).toEqual(['press up']);

    setButton(controller, 12, false);
    frames.fire();
    expect(calls).toEqual(['press up']);
    expect(inspection.pressed().has('up')).toBe(true);

    controller.axes[1] = 0;
    frames.fire();
    expect(calls).toEqual(['press up', 'release up']);
  });

  it('hands a target only what changed since the last frame', () => {
    const controller = fakePad(0);
    pads[0] = controller;
    const target = new RecordingTarget();
    register(target);

    setButton(controller, 1, true);
    frames.fire();
    frames.fire();
    controller.buttons[7] = { pressed: true, value: 0.8 };
    frames.fire();
    setButton(controller, 1, false);
    frames.fire();

    expect(target.calls).toEqual([
      'down a 0:button-1',
      'down r 0:button-7',
      'up a 0:button-1'
    ]);
  });

  it('plays nothing on a control the pad does not have', () => {
    const controller = fakePad(0);
    pads[0] = controller;
    const { calls } = played({ shoulders: 0 });

    setButton(controller, 4, true);
    controller.buttons[7] = { pressed: true, value: 1 };
    setButton(controller, 1, true);
    frames.fire();

    expect(calls).toEqual(['press a']);
  });

  it('releases what a controller held when it disconnects, and frees the target', () => {
    const controller = fakePad(0);
    pads[0] = controller;
    const { inspection, calls } = played();
    setButton(controller, 1, true);
    frames.fire();

    disconnect(0);

    expect(calls).toEqual(['press a', 'release a']);
    expect(service.assignmentOf(inspection)()).toBeNull();
    expect(service.controllers()).toEqual([]);
  });

  it('gives a newly registered target the first free supported controller', () => {
    pads[0] = fakePad(0, '');
    pads[1] = fakePad(1);
    pads[2] = fakePad(2);
    const first = new RecordingTarget();
    const second = new RecordingTarget();
    const third = new RecordingTarget();
    register(first);
    register(second);
    register(third);

    expect(service.assignmentOf(first)()).toBe(1);
    expect(service.assignmentOf(second)()).toBe(2);
    expect(service.assignmentOf(third)()).toBeNull();
  });

  it('gives a controller that connects to the open target without one', () => {
    const target = new RecordingTarget();
    register(target);
    expect(service.assignmentOf(target)()).toBeNull();

    connect(fakePad(0));
    expect(service.assignmentOf(target)()).toBe(0);
  });

  it('refuses a controller whose layout is not the standard mapping', () => {
    pads[0] = fakePad(0, '');
    const target = new RecordingTarget();
    register(target);

    expect(service.controllers()).toEqual([
      expect.objectContaining({ index: 0, supported: false })
    ]);
    expect(service.assign(0, target)).toBe(false);
    expect(service.assignmentOf(target)()).toBeNull();
  });

  it('moves a controller rather than sharing it, releasing what the other target held', () => {
    const controller = fakePad(0);
    pads[0] = controller;
    const one = played();
    const two = played();
    expect(service.assignmentOf(one.inspection)()).toBe(0);
    expect(service.assignmentOf(two.inspection)()).toBeNull();

    setButton(controller, 0, true);
    frames.fire();
    expect(one.calls).toEqual(['press b']);

    expect(service.assign(0, two.inspection)).toBe(true);
    expect(one.calls).toEqual(['press b', 'release b']);
    expect(service.assignmentOf(one.inspection)()).toBeNull();
    expect(service.assignmentOf(two.inspection)()).toBe(0);

    // The button still held now belongs to the target the controller moved to.
    frames.fire();
    expect(two.calls).toEqual(['press b']);
    expect(one.calls).toEqual(['press b', 'release b']);
  });

  it('polls only while a controller is assigned', () => {
    pads[0] = fakePad(0);
    const target = new RecordingTarget();
    register(target);
    frames.fire();
    const reads = getGamepads.mock.calls.length;

    service.unassign(target);
    frames.fire();
    frames.fire();

    expect(frames.scheduledCount).toBe(0);
    expect(getGamepads.mock.calls.length).toBe(reads);
  });

  it('stops polling and releases when the simulation stops being ready, and resumes after', () => {
    const controller = fakePad(0);
    pads[0] = controller;
    const { calls } = played();
    setButton(controller, 1, true);
    frames.fire();

    ready.set(false);
    TestBed.tick();
    expect(calls).toEqual(['press a', 'release a']);
    const reads = getGamepads.mock.calls.length;
    frames.fire();
    expect(getGamepads.mock.calls.length).toBe(reads);

    ready.set(true);
    TestBed.tick();
    frames.fire();
    expect(calls).toEqual(['press a', 'release a', 'press a']);
  });

  it('releases and stops polling when the page is hidden', () => {
    const controller = fakePad(0);
    pads[0] = controller;
    const { calls } = played();
    setButton(controller, 9, true);
    frames.fire();

    setVisibility('hidden');

    expect(calls).toEqual(['press start', 'release start']);
    const reads = getGamepads.mock.calls.length;
    frames.fire();
    expect(getGamepads.mock.calls.length).toBe(reads);
  });

  it('presses no slot while the window assigns keys', () => {
    const controller = fakePad(0);
    pads[0] = controller;
    const { inspection, calls } = played();
    setButton(controller, 0, true);
    frames.fire();

    inspection.setAssigning(true);
    expect(calls).toEqual(['press b', 'release b']);

    setButton(controller, 1, true);
    controller.axes[0] = 1;
    frames.fire();
    expect(calls).toEqual(['press b', 'release b']);
  });

  it('releases a closed window and frees its controller for the next one', () => {
    const controller = fakePad(0);
    pads[0] = controller;
    const closed = played();
    expect(service.assignmentOf(closed.inspection)()).toBe(0);
    setButton(controller, 1, true);
    frames.fire();

    closed.inspection.destroy();
    expect(closed.calls).toEqual(['press a', 'release a']);
    expect(service.assignmentOf(closed.inspection)()).toBeNull();

    const next = new RecordingTarget();
    register(next);
    expect(service.assignmentOf(next)()).toBe(0);
  });
});
