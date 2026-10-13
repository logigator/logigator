import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ApplicationRef,
  Component,
  inject,
  signal,
  WritableSignal
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LgWindowOutlet } from '@logigator/ui';
import { Subject } from 'rxjs';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { makeGamepad } from '../../../../testing/factories';
import { ManualFrameScheduler } from '../../../../testing/fake-simulation-worker';
import {
  GamepadHardwareService,
  GamepadReading
} from '../../../inspection/gamepad/gamepad-hardware.service';
import { InspectionSheetComponent } from '../../../inspection/inspection-sheet.component';
import { InspectionService } from '../../../inspection/inspection.service';
import { LayoutService } from '../../../layout/layout.service';
import { FRAME_SCHEDULER } from '../../../simulation/worker/simulation-worker.service';
import { WorkModeService } from '../../../work-mode/work-mode.service';
import {
  GamepadKeyboardService,
  GamepadKeyTarget
} from '../../../inspection/gamepad/gamepad-keyboard.service';
import { SimulationService } from '../../../simulation/simulation.service';
import {
  GAMEPAD_KEYS_STORAGE_KEY,
  GamepadBindingsService
} from '../../../shortcuts/gamepad-bindings.service';
import { InputRoute } from '../../component-inspection';
import { GamepadComponent } from './gamepad.component';
import { GamepadInspection } from './gamepad-inspection';
import { GamepadInspectionComponent } from './gamepad-inspection.component';

/**
 * A route that records what reaches it and, like the simulation, shows a
 * pressed slot on the component.
 */
function recordingRoute(pad: GamepadComponent): InputRoute & {
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
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
}

describe('GamepadInspection', () => {
  let pad: GamepadComponent;
  let route: ReturnType<typeof recordingRoute>;
  let inspection: GamepadInspection;

  beforeEach(() => {
    configureTestBed();
    pad = makeGamepad({ face: 4, shoulders: 2 });
    route = recordingRoute(pad);
    inspection = new GamepadInspection(pad, route);
  });

  afterEach(() => {
    pad.destroy({ children: true });
  });

  it('keeps a control held by a key and a pointer until both have let go', () => {
    inspection.keyDown('a', 'KeyX');
    inspection.pointerDown('a', 7);
    expect(route.calls).toEqual(['press a']);

    inspection.keyUp('a', 'KeyX');
    expect(route.calls).toEqual(['press a']);
    expect(inspection.pressed().has('a')).toBe(true);

    inspection.pointerUp('a', 7);
    expect(route.calls).toEqual(['press a', 'release a']);
    expect(inspection.pressed().has('a')).toBe(false);
  });

  it('keeps a control held by a key, a pointer and a controller until all three let go', () => {
    inspection.keyDown('a', 'KeyX');
    inspection.pointerDown('a', 7);
    inspection.padDown('a', '0:button-1');

    inspection.keyUp('a', 'KeyX');
    inspection.pointerUp('a', 7);
    expect(route.calls).toEqual(['press a']);

    inspection.padUp('a', '0:button-1');
    expect(route.calls).toEqual(['press a', 'release a']);
  });

  it('drops only the controller holds when the controller lets go', () => {
    inspection.padDown('up', '0:button-12');
    inspection.padDown('b', '0:button-0');
    inspection.keyDown('b', 'KeyZ');

    inspection.releasePad();

    expect(route.calls).toEqual(['press up', 'press b', 'release up']);
    expect([...inspection.pressed()]).toEqual(['b']);
  });

  it('sends each control to its own slot, and a repeated holder nothing', () => {
    inspection.pointerDown('l', 1);
    inspection.pointerDown('l', 1);
    inspection.keyDown('start', 'Enter');
    inspection.pointerUp('b', 1);

    expect(route.calls).toEqual(['press l', 'press start']);
    expect(pad.isActive(pad.slotIds.indexOf('l'))).toBe(true);
    expect(pad.isActive(pad.slotIds.indexOf('start'))).toBe(true);
  });

  it('drops only the keys when the keyboard lets go, keeping pointer holds', () => {
    inspection.keyDown('up', 'ArrowUp');
    inspection.keyDown('a', 'KeyX');
    inspection.pointerDown('a', 3);

    inspection.releaseKeys();

    expect(route.calls).toEqual(['press up', 'press a', 'release up']);
    expect([...inspection.pressed()]).toEqual(['a']);
  });

  it('releases every held slot through the route when destroyed', () => {
    inspection.keyDown('up', 'ArrowUp');
    inspection.pointerDown('up', 2);
    inspection.pointerDown('x', 4);
    inspection.keyDown('r', 'KeyW');
    route.calls.length = 0;

    inspection.destroy();

    expect([...route.calls].sort()).toEqual(
      ['release r', 'release up', 'release x'].sort()
    );
    expect(pad.slotIds.some((_, slot) => pad.isActive(slot))).toBe(false);
  });

  it('shows a slot pressed some other way once a frame is applied', () => {
    pad.setActive(pad.slotIds.indexOf('y'), true);
    expect(inspection.pressed().has('y')).toBe(false);

    inspection.onFrame();
    expect(inspection.pressed().has('y')).toBe(true);
  });
});

describe('GamepadInspectionComponent', () => {
  let pad: GamepadComponent;
  let route: ReturnType<typeof recordingRoute>;
  let registered: GamepadKeyTarget[];
  let unregistered: GamepadKeyTarget[];
  let frame: HTMLElement;

  beforeEach(() => {
    registered = [];
    unregistered = [];
    const fakeKeyboard: Pick<GamepadKeyboardService, 'register'> = {
      register: (target) => {
        registered.push(target);
        return () => unregistered.push(target);
      }
    };
    configureTestBed(
      [{ provide: GamepadKeyboardService, useValue: fakeKeyboard }],
      [GamepadInspectionComponent]
    );
    pad = makeGamepad();
    route = recordingRoute(pad);
    frame = document.createElement('div');
    frame.setAttribute('role', 'dialog');
    document.body.appendChild(frame);
  });

  afterEach(() => {
    frame.remove();
    pad.destroy({ children: true });
  });

  function render(): {
    inspection: GamepadInspection;
    destroy: () => void;
  } {
    const inspection = new GamepadInspection(pad, route);
    const fixture = TestBed.createComponent(GamepadInspectionComponent);
    frame.appendChild(fixture.nativeElement as HTMLElement);
    fixture.componentRef.setInput('inspection', inspection);
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    return { inspection, destroy: () => fixture.destroy() };
  }

  it('routes keys by focus within its frame and plays them as slot presses', () => {
    const view = render();

    expect(registered).toHaveLength(1);
    const target = registered[0];
    expect(target.host).toBe(frame);
    expect(frame.contains(document.activeElement)).toBe(true);

    target.keyDown('b', 'KeyZ');
    target.keyDown('up', 'ArrowUp');
    target.keyUp('b', 'KeyZ');
    expect(route.calls).toEqual(['press b', 'press up', 'release b']);
    expect(pad.isActive(pad.slotIds.indexOf('up'))).toBe(true);

    view.destroy();
    expect(unregistered).toEqual([target]);
  });

  it('lets go of its pointers when the view goes and the inspection stays', () => {
    const view = render();
    view.inspection.pointerDown('a', 5);
    view.inspection.keyDown('b', 'KeyZ');
    route.calls.length = 0;

    view.destroy();

    expect(route.calls).toEqual(['release a']);
    expect(view.inspection.pressed().has('b')).toBe(true);
  });
});

describe('GamepadInspectionComponent in assign mode', () => {
  let pad: GamepadComponent;
  let route: ReturnType<typeof recordingRoute>;
  let frame: HTMLElement;
  let fixture: ComponentFixture<GamepadInspectionComponent>;
  let inspection: GamepadInspection;
  let bindings: GamepadBindingsService;
  /** Key events that reached the frame, where the window closes on Escape. */
  let atFrame: string[];
  /** Key events that reached `window` in the bubble phase, as shortcuts do. */
  let atWindow: string[];

  const onFrame = (e: KeyboardEvent): void => {
    atFrame.push(e.code);
  };
  const onWindow = (e: KeyboardEvent): void => {
    atWindow.push(e.code);
  };

  /** Dispatches on the focused element, as the browser does. */
  function press(code: string, init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      code,
      key: code,
      bubbles: true,
      cancelable: true,
      ...init
    });
    (document.activeElement ?? document.body).dispatchEvent(event);
    return event;
  }

  function release(code: string): void {
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent('keyup', { code, key: code, bubbles: true })
    );
  }

  function control(id: string): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector(
      `button[data-control="${id}"]`
    )!;
  }

  function enterAssign(): void {
    fixture.componentInstance.enterAssign();
    fixture.detectChanges();
  }

  /** Clicks a control in assign mode, which starts its capture. */
  function pick(id: string): void {
    control(id).click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    localStorage.removeItem(GAMEPAD_KEYS_STORAGE_KEY);
    configureTestBed(
      [{ provide: SimulationService, useValue: { isReady: signal(true) } }],
      [GamepadInspectionComponent]
    );
    bindings = TestBed.inject(GamepadBindingsService);
    pad = makeGamepad({ face: 4, shoulders: 2 });
    route = recordingRoute(pad);
    inspection = new GamepadInspection(pad, route);

    frame = document.createElement('div');
    frame.setAttribute('role', 'dialog');
    document.body.appendChild(frame);
    atFrame = [];
    atWindow = [];
    frame.addEventListener('keydown', onFrame);
    window.addEventListener('keydown', onWindow);

    fixture = TestBed.createComponent(GamepadInspectionComponent);
    frame.appendChild(fixture.nativeElement as HTMLElement);
    fixture.componentRef.setInput('inspection', inspection);
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
  });

  afterEach(() => {
    window.removeEventListener('keydown', onWindow);
    fixture.destroy();
    frame.remove();
    pad.destroy({ children: true });
    TestBed.resetTestingModule();
    localStorage.removeItem(GAMEPAD_KEYS_STORAGE_KEY);
  });

  it('releases every hold through the route on entry, and plays no key while assigning', () => {
    press('KeyZ');
    inspection.pointerDown('a', 4);
    expect(route.calls).toEqual(['press b', 'press a']);

    enterAssign();
    expect([...route.calls.slice(2)].sort()).toEqual([
      'release a',
      'release b'
    ]);
    expect(pad.slotIds.some((_, slot) => pad.isActive(slot))).toBe(false);

    route.calls.length = 0;
    control('x').focus();
    press('KeyS');
    release('KeyS');
    control('y').dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true })
    );
    expect(route.calls).toEqual([]);
  });

  it('routes play keys to the pad again once assign mode is left', () => {
    enterAssign();
    fixture.componentInstance.leaveAssign();
    fixture.detectChanges();

    const down = press('KeyX');
    expect(down.defaultPrevented).toBe(true);
    expect(route.calls).toEqual(['press a']);
  });

  it('assigns the next key to the picked control and consumes it', () => {
    enterAssign();
    pick('up');
    const down = press('KeyK');

    expect(down.defaultPrevented).toBe(true);
    expect(atWindow).toEqual([]);
    expect(bindings.bindings().up).toBe('KeyK');
    expect(fixture.componentInstance.capturing()).toBeNull();
    expect(route.calls).toEqual([]);
  });

  it('flashes the control a swap moved onto the old key', () => {
    enterAssign();
    pick('up');
    press('KeyX');

    expect(bindings.bindings().up).toBe('KeyX');
    expect(bindings.bindings().a).toBe('ArrowUp');
    expect(fixture.componentInstance.flashed()).toBe('a');
  });

  it('cancels the capture on Escape without the window seeing it', () => {
    enterAssign();
    pick('up');
    const escape = press('Escape');

    expect(atFrame).toEqual([]);
    expect(escape.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.capturing()).toBeNull();

    press('KeyK');
    expect(bindings.bindings().up).toBe('ArrowUp');
  });

  it('lets Tab through rather than capturing it', () => {
    enterAssign();
    pick('up');
    const tab = press('Tab', { key: 'Tab' });

    expect(tab.defaultPrevented).toBe(false);
    expect(atFrame).toEqual(['Tab']);
    expect(bindings.bindings().up).toBe('ArrowUp');
  });

  it('unbinds the capturing control on Backspace', () => {
    enterAssign();
    pick('b');
    press('Backspace');

    expect(bindings.bindings().b).toBeNull();
    expect(bindings.controlFor('KeyZ')).toBeNull();
  });
});

describe('GamepadInspectionComponent with a controller connected', () => {
  let pad: GamepadComponent;
  let frame: HTMLElement;

  beforeEach(() => {
    const controller = {
      index: 0,
      id: 'Pad (STANDARD GAMEPAD Vendor: 045e Product: 0b13)',
      mapping: 'standard',
      connected: true,
      buttons: [],
      axes: []
    };
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [controller]
    });
    configureTestBed(
      [{ provide: SimulationService, useValue: { isReady: signal(true) } }],
      [GamepadInspectionComponent]
    );
    pad = makeGamepad();
    frame = document.createElement('div');
    frame.setAttribute('role', 'dialog');
    document.body.appendChild(frame);
  });

  afterEach(() => {
    frame.remove();
    pad.destroy({ children: true });
    TestBed.resetTestingModule();
    delete (navigator as { getGamepads?: unknown }).getGamepads;
  });

  it('keeps the free controller from opening to closing, whichever view shows it', () => {
    const hardware = TestBed.inject(GamepadHardwareService);
    const inspection = new GamepadInspection(pad, recordingRoute(pad));
    expect(hardware.assignmentOf(inspection)()).toBe(0);

    const fixture = TestBed.createComponent(GamepadInspectionComponent);
    frame.appendChild(fixture.nativeElement as HTMLElement);
    fixture.componentRef.setInput('inspection', inspection);
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    fixture.destroy();
    expect(hardware.assignmentOf(inspection)()).toBe(0);

    inspection.destroy();
    expect(hardware.assignmentOf(inspection)()).toBeNull();
  });
});

/** The two frames a gamepad view moves between when the breakpoint flips. */
@Component({
  selector: 'app-presentation-host',
  imports: [LgWindowOutlet, InspectionSheetComponent],
  template: `
    @if (!compact()) {
      <lg-window-outlet />
    }
    <app-inspection-sheet />
  `
})
class PresentationHost {
  protected readonly compact = inject(LayoutService).isCompact;
}

describe('GamepadInspectionComponent across a breakpoint flip', () => {
  let pad: GamepadComponent;
  let route: ReturnType<typeof recordingRoute>;
  let controllers: ReturnType<typeof fakeController>[];
  let compact: WritableSignal<boolean>;
  let frames: ManualFrameScheduler;
  let fixture: ComponentFixture<PresentationHost>;
  let inspections: InspectionService;
  let hardware: GamepadHardwareService;

  /** A pointer event on a pointer id, as jsdom has no PointerEvent. */
  function pointer(type: string, pointerId: number): Event {
    const event = new MouseEvent(type, { bubbles: true, button: 0 });
    Object.defineProperty(event, 'pointerId', { value: pointerId });
    Object.defineProperty(event, 'pointerType', { value: 'touch' });
    return event;
  }

  function settle(): void {
    for (let i = 0; i < 3; i++) TestBed.inject(ApplicationRef).tick();
  }

  /** The one rendered gamepad view, in whichever frame holds it. */
  function view(): GamepadInspectionComponent {
    const views = fixture.debugElement.queryAll(
      By.directive(GamepadInspectionComponent)
    );
    expect(views).toHaveLength(1);
    return views[0].componentInstance as GamepadInspectionComponent;
  }

  function pressKey(code: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      code,
      key: code,
      bubbles: true,
      cancelable: true
    });
    (document.activeElement ?? document.body).dispatchEvent(event);
    return event;
  }

  function fakeController(index: number): GamepadReading & {
    buttons: { pressed: boolean; value: number }[];
    axes: number[];
  } {
    return {
      index,
      id: `Pad ${index} (STANDARD GAMEPAD Vendor: 045e Product: 0b13)`,
      mapping: 'standard',
      connected: true,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      axes: [0, 0, 0, 0]
    };
  }

  beforeEach(() => {
    localStorage.removeItem(GAMEPAD_KEYS_STORAGE_KEY);
    controllers = [fakeController(0), fakeController(1)];
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => controllers
    });
    compact = signal(false);
    frames = new ManualFrameScheduler();
    configureTestBed(
      [
        {
          provide: SimulationService,
          useValue: { isReady: signal(true), frame$: new Subject<void>() }
        },
        {
          provide: LayoutService,
          useValue: { isCompact: compact, isTouch: signal(false) }
        },
        { provide: FRAME_SCHEDULER, useValue: frames }
      ],
      [PresentationHost]
    );
    TestBed.inject(WorkModeService).setSimulationMode(true);
    inspections = TestBed.inject(InspectionService);
    hardware = TestBed.inject(GamepadHardwareService);
    fixture = TestBed.createComponent(PresentationHost);
    document.body.appendChild(fixture.nativeElement as HTMLElement);
    settle();

    pad = makeGamepad();
    route = recordingRoute(pad);
    inspections.openFor(pad, { input: route });
    settle();
  });

  afterEach(() => {
    inspections.closeAll();
    fixture.destroy();
    (fixture.nativeElement as HTMLElement).remove();
    pad.destroy({ children: true });
    TestBed.resetTestingModule();
    localStorage.removeItem(GAMEPAD_KEYS_STORAGE_KEY);
    delete (navigator as { getGamepads?: unknown }).getGamepads;
  });

  function inspection(): GamepadInspection {
    return inspections.open()[0].inspection as GamepadInspection;
  }

  it('lets go of what the old view’s pointers held, keeping the controller and its holds', () => {
    expect(hardware.assign(1, inspection())).toBe(true);
    controllers[1].buttons[0] = { pressed: true, value: 1 };
    frames.fire();
    document
      .querySelector('button[data-control="a"]')!
      .dispatchEvent(pointer('pointerdown', 3));
    expect(route.calls).toEqual(['press b', 'press a']);

    compact.set(true);
    settle();

    expect(
      document.querySelector('[role="dialog"] app-gamepad-inspection')
    ).not.toBeNull();
    expect(route.calls).toEqual(['press b', 'press a', 'release a']);
    expect([...inspection().pressed()]).toEqual(['b']);
    expect(hardware.assignmentOf(inspection())()).toBe(1);

    // The controller plays the rebuilt view on, and releases where it held.
    controllers[1].buttons[0] = { pressed: false, value: 0 };
    frames.fire();
    expect(route.calls.at(-1)).toBe('release b');
  });

  it('resumes assign mode in the new frame, which takes no play key until it is left', () => {
    view().enterAssign();
    settle();

    compact.set(true);
    settle();

    expect(inspection().assigning()).toBe(true);
    pressKey('KeyX');
    expect(route.calls).toEqual([]);

    view().leaveAssign();
    settle();
    expect(pressKey('KeyX').defaultPrevented).toBe(true);
    expect(route.calls).toEqual(['press a']);
  });
});
