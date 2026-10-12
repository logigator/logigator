import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApplicationRef, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { makeGamepad } from '../../testing/factories';
import { ManualFrameScheduler } from '../../testing/fake-simulation-worker';
import { InputRoute } from '../components/component-inspection';
import { GamepadComponent } from '../components/component-types/gamepad/gamepad.component';
import { GamepadInspection } from '../components/component-types/gamepad/gamepad-inspection';
import { LayoutService } from '../layout/layout.service';
import { GAMEPAD_KEYS_STORAGE_KEY } from '../shortcuts/gamepad-bindings.service';
import { SimulationService } from '../simulation/simulation.service';
import { FRAME_SCHEDULER } from '../simulation/worker/simulation-worker.service';
import { GamepadHardwareService } from './gamepad/gamepad-hardware.service';
import { OpenInspection } from './inspection-presenter';
import { InspectionSheetComponent } from './inspection-sheet.component';
import { SheetInspectionPresenter } from './sheet-inspection.presenter';

/** One gamepad in the sheet, with what its presses reached. */
interface PlayedTab {
  readonly pad: GamepadComponent;
  readonly entry: OpenInspection;
  readonly calls: string[];
}

describe('InspectionSheetComponent with two gamepad tabs', () => {
  let fixture: ComponentFixture<InspectionSheetComponent>;
  let presenter: SheetInspectionPresenter;
  let frames: ManualFrameScheduler;
  let controller: {
    index: number;
    id: string;
    mapping: GamepadMappingType;
    connected: boolean;
    buttons: { pressed: boolean; value: number }[];
    axes: number[];
  };
  let first: PlayedTab;
  let second: PlayedTab;

  function played(): PlayedTab {
    const pad = makeGamepad();
    const calls: string[] = [];
    const route: InputRoute = {
      press: (slot) => {
        calls.push(`press ${pad.slotIds[slot]}`);
        pad.setActive(slot, true);
      },
      release: (slot) => {
        calls.push(`release ${pad.slotIds[slot]}`);
        pad.setActive(slot, false);
      }
    };
    return {
      pad,
      calls,
      entry: { component: pad, inspection: new GamepadInspection(pad, route) }
    };
  }

  function settle(): void {
    for (let i = 0; i < 3; i++) TestBed.inject(ApplicationRef).tick();
  }

  /** Presses and lets go of a key where focus is, as the browser does. */
  function tapKey(code: string): void {
    const target = document.activeElement ?? document.body;
    for (const type of ['keydown', 'keyup']) {
      target.dispatchEvent(
        new KeyboardEvent(type, { code, key: code, bubbles: true })
      );
    }
  }

  function showTab(tab: PlayedTab): void {
    presenter.focus(tab.entry);
    settle();
  }

  beforeEach(() => {
    localStorage.removeItem(GAMEPAD_KEYS_STORAGE_KEY);
    controller = {
      index: 0,
      id: 'Pad (STANDARD GAMEPAD Vendor: 045e Product: 0b13)',
      mapping: 'standard',
      connected: true,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      axes: [0, 0, 0, 0]
    };
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [controller]
    });
    frames = new ManualFrameScheduler();
    configureTestBed(
      [
        { provide: SimulationService, useValue: { isReady: signal(true) } },
        {
          provide: LayoutService,
          useValue: { isCompact: signal(true), isTouch: signal(true) }
        },
        { provide: FRAME_SCHEDULER, useValue: frames }
      ],
      [InspectionSheetComponent]
    );
    presenter = TestBed.inject(SheetInspectionPresenter);
    fixture = TestBed.createComponent(InspectionSheetComponent);
    document.body.appendChild(fixture.nativeElement as HTMLElement);

    first = played();
    second = played();
    presenter.show(first.entry, () => undefined);
    presenter.show(second.entry, () => undefined);
    settle();
  });

  afterEach(() => {
    presenter.dismissAll();
    settle();
    fixture.destroy();
    (fixture.nativeElement as HTMLElement).remove();
    for (const tab of [first, second]) {
      tab.entry.inspection.destroy?.();
      tab.pad.destroy({ children: true });
    }
    TestBed.resetTestingModule();
    localStorage.removeItem(GAMEPAD_KEYS_STORAGE_KEY);
    delete (navigator as { getGamepads?: unknown }).getGamepads;
  });

  it('plays the keyboard on the visible pad only, following a tab switch', () => {
    tapKey('KeyX');
    expect(second.calls).toEqual(['press a', 'release a']);
    expect(first.calls).toEqual([]);

    showTab(first);
    tapKey('KeyZ');
    expect(first.calls).toEqual(['press b', 'release b']);
    expect(second.calls).toEqual(['press a', 'release a']);

    showTab(second);
    tapKey('KeyX');
    expect(second.calls).toEqual([
      'press a',
      'release a',
      'press a',
      'release a'
    ]);
    expect(first.calls).toEqual(['press b', 'release b']);
  });

  it('releases a key held on a pad when its tab is switched away', () => {
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyX', key: 'x', bubbles: true })
    );
    expect(second.calls).toEqual(['press a']);

    showTab(first);
    expect(second.calls).toEqual(['press a', 'release a']);
    expect(first.calls).toEqual([]);
  });

  it('keeps a controller on its pad behind another tab, still playing it', () => {
    const hardware = TestBed.inject(GamepadHardwareService);
    const firstPad = first.entry.inspection as GamepadInspection;
    const secondPad = second.entry.inspection as GamepadInspection;
    expect(hardware.assignmentOf(firstPad)()).toBe(0);
    expect(hardware.assignmentOf(secondPad)()).toBeNull();

    controller.buttons[1] = { pressed: true, value: 1 };
    frames.fire();
    expect(first.calls).toEqual(['press a']);

    showTab(first);
    showTab(second);
    frames.fire();
    expect(hardware.assignmentOf(firstPad)()).toBe(0);
    expect(hardware.assignmentOf(secondPad)()).toBeNull();
    expect(first.calls).toEqual(['press a']);
    expect(second.calls).toEqual([]);
  });
});
