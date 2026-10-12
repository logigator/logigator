import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { makeGamepad } from '../../../../testing/factories';
import {
  GamepadKeyboardService,
  GamepadKeyTarget
} from '../../../inspection/gamepad/gamepad-keyboard.service';
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
    }
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
