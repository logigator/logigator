import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GamepadControlId } from '@logigator/core';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { SimulationService } from '../../simulation/simulation.service';
import {
  GAMEPAD_KEYS_STORAGE_KEY,
  GamepadBindingsService
} from '../../shortcuts/gamepad-bindings.service';
import {
  GamepadKeyboardService,
  GamepadKeyTarget
} from './gamepad-keyboard.service';

/** A pad view: a focusable host with a button inside, recording its calls. */
class RecordingTarget implements GamepadKeyTarget {
  public readonly host = document.createElement('div');
  public readonly button = document.createElement('button');
  public readonly calls: string[] = [];

  constructor() {
    this.host.tabIndex = -1;
    this.host.appendChild(this.button);
    document.body.appendChild(this.host);
  }

  keyDown(control: GamepadControlId, code: string): void {
    this.calls.push(`down ${control} ${code}`);
  }

  keyUp(control: GamepadControlId, code: string): void {
    this.calls.push(`up ${control} ${code}`);
  }

  releaseKeys(): void {
    this.calls.push('release');
  }
}

function key(
  type: 'keydown' | 'keyup',
  code: string,
  init: KeyboardEventInit = {}
): KeyboardEvent {
  return new KeyboardEvent(type, {
    code,
    key: code,
    bubbles: true,
    cancelable: true,
    ...init
  });
}

describe('GamepadKeyboardService', () => {
  let service: GamepadKeyboardService;
  let ready: WritableSignal<boolean>;
  let one: RecordingTarget;
  let two: RecordingTarget;
  let outside: HTMLButtonElement;
  /** Codes of the key events that reached a bubble-phase window listener. */
  let bubbled: string[];
  const disposers: (() => void)[] = [];

  const onBubble = (e: KeyboardEvent): void => {
    bubbled.push(`${e.type} ${e.code}`);
  };

  /**
   * Moves focus out of a pad without a `focusout` reaching the window
   * listener, so the press stays held on the pad it came from.
   */
  function focusSilently(element: HTMLElement): void {
    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      get: () => element
    });
  }

  /** Dispatches on the focused element, as the browser does. */
  function press(event: KeyboardEvent): KeyboardEvent {
    (document.activeElement ?? document.body).dispatchEvent(event);
    return event;
  }

  beforeEach(() => {
    localStorage.removeItem(GAMEPAD_KEYS_STORAGE_KEY);
    ready = signal(true);
    configureTestBed([
      { provide: SimulationService, useValue: { isReady: ready } }
    ]);
    service = TestBed.inject(GamepadKeyboardService);

    one = new RecordingTarget();
    two = new RecordingTarget();
    outside = document.createElement('button');
    document.body.appendChild(outside);
    disposers.push(service.register(one), service.register(two));

    bubbled = [];
    window.addEventListener('keydown', onBubble);
    window.addEventListener('keyup', onBubble);
  });

  afterEach(() => {
    window.removeEventListener('keydown', onBubble);
    window.removeEventListener('keyup', onBubble);
    for (const dispose of disposers.splice(0)) dispose();
    delete (document as { activeElement?: Element }).activeElement;
    TestBed.resetTestingModule();
    document.body.replaceChildren();
  });

  it('sends a key only to the target whose host holds the focus', () => {
    two.button.focus();
    press(key('keydown', 'KeyX'));
    press(key('keyup', 'KeyX'));

    expect(two.calls).toEqual(['down a KeyX', 'up a KeyX']);
    expect(one.calls).toEqual([]);
  });

  it('routes nothing while focus is outside every pad', () => {
    outside.focus();
    const down = press(key('keydown', 'KeyX'));

    expect(down.defaultPrevented).toBe(false);
    expect(bubbled).toEqual(['keydown KeyX']);
    expect(one.calls).toEqual([]);
    expect(two.calls).toEqual([]);
  });

  it('consumes a bound key before a bubble-phase listener sees it', () => {
    one.button.focus();
    const down = press(key('keydown', 'Enter'));
    const up = press(key('keyup', 'Enter'));

    expect(down.defaultPrevented).toBe(true);
    expect(up.defaultPrevented).toBe(true);
    expect(bubbled).toEqual([]);
  });

  describe('passes through, unconsumed', () => {
    beforeEach(() => one.button.focus());

    it('an unbound key', () => {
      const down = press(key('keydown', 'KeyP'));

      expect(down.defaultPrevented).toBe(false);
      expect(bubbled).toEqual(['keydown KeyP']);
      expect(one.calls).toEqual([]);
    });

    it('Escape', () => {
      const down = press(key('keydown', 'Escape'));

      expect(down.defaultPrevented).toBe(false);
      expect(bubbled).toEqual(['keydown Escape']);
    });

    it.each<[string, KeyboardEventInit]>([
      ['ctrlKey', { ctrlKey: true }],
      ['metaKey', { metaKey: true }],
      ['altKey', { altKey: true }]
    ])('a bound key with %s held', (_, modifier) => {
      const down = press(key('keydown', 'KeyZ', modifier));

      expect(down.defaultPrevented).toBe(false);
      expect(bubbled).toEqual(['keydown KeyZ']);
      expect(one.calls).toEqual([]);
    });

    it('a bound key typed into a field inside the pad', () => {
      const field = document.createElement('input');
      one.host.appendChild(field);
      field.focus();

      const down = press(key('keydown', 'KeyX'));

      expect(down.defaultPrevented).toBe(false);
      expect(bubbled).toEqual(['keydown KeyX']);
      expect(one.calls).toEqual([]);
    });

    it('a bound key while the simulation is not ready', () => {
      ready.set(false);
      const down = press(key('keydown', 'KeyX'));

      expect(down.defaultPrevented).toBe(false);
      expect(bubbled).toEqual(['keydown KeyX']);
      expect(one.calls).toEqual([]);
    });
  });

  it('plays a modifier bound to a control, which reports its own flag', () => {
    TestBed.inject(GamepadBindingsService).assign('select', 'ControlLeft');
    one.button.focus();
    const down = press(key('keydown', 'ControlLeft', { ctrlKey: true }));

    expect(down.defaultPrevented).toBe(true);
    expect(one.calls).toEqual(['down select ControlLeft']);
  });

  it('presses once for a held key that repeats', () => {
    one.button.focus();
    press(key('keydown', 'KeyX'));
    const repeat = press(key('keydown', 'KeyX', { repeat: true }));
    press(key('keydown', 'KeyX', { repeat: true }));
    press(key('keyup', 'KeyX'));

    expect(repeat.defaultPrevented).toBe(true);
    expect(one.calls).toEqual(['down a KeyX', 'up a KeyX']);
    expect(bubbled).toEqual([]);
  });

  it('matches the keyup by code when Shift changed the key in between', () => {
    one.button.focus();
    press(key('keydown', 'KeyX', { key: 'x' }));
    press(key('keyup', 'KeyX', { key: 'X', shiftKey: true }));

    expect(one.calls).toEqual(['down a KeyX', 'up a KeyX']);
  });

  it('releases a held key on the target it pressed, wherever focus is', () => {
    one.button.focus();
    press(key('keydown', 'ArrowUp'));
    focusSilently(two.button);
    press(key('keyup', 'ArrowUp'));

    expect(one.calls).toEqual(['down up ArrowUp', 'up up ArrowUp']);
    expect(two.calls).toEqual([]);
  });

  it('releases only the pad focus moves out of', () => {
    one.button.focus();
    press(key('keydown', 'KeyX'));
    focusSilently(two.button);
    press(key('keydown', 'KeyZ'));

    two.button.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: outside })
    );

    expect(two.calls).toEqual(['down b KeyZ', 'release']);
    expect(one.calls).toEqual(['down a KeyX']);
    // The released key's keyup is no longer the service's to consume.
    expect(press(key('keyup', 'KeyZ')).defaultPrevented).toBe(false);
    expect(press(key('keyup', 'KeyX')).defaultPrevented).toBe(true);
  });

  it('releases a pad when focus moves into another pad', () => {
    one.button.focus();
    press(key('keydown', 'KeyX'));
    two.button.focus();

    expect(one.calls).toEqual(['down a KeyX', 'release']);
  });

  it('keeps holds when focus moves within the same pad', () => {
    one.button.focus();
    press(key('keydown', 'KeyX'));
    one.host.focus();

    expect(one.calls).toEqual(['down a KeyX']);
  });

  it('releases every target on a window blur', () => {
    one.button.focus();
    press(key('keydown', 'KeyX'));
    focusSilently(two.button);
    press(key('keydown', 'KeyZ'));

    window.dispatchEvent(new FocusEvent('blur'));

    expect(one.calls).toEqual(['down a KeyX', 'release']);
    expect(two.calls).toEqual(['down b KeyZ', 'release']);
  });

  it('releases what a target holds when it unregisters', () => {
    const three = new RecordingTarget();
    const dispose = service.register(three);
    three.button.focus();
    press(key('keydown', 'KeyX'));

    dispose();

    expect(three.calls).toEqual(['down a KeyX', 'release']);
    expect(press(key('keyup', 'KeyX')).defaultPrevented).toBe(false);
  });
});
