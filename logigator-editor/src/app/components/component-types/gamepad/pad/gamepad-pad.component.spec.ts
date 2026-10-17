import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { gamepadControls, NameMap } from '@logigator/core';
import { configureTestBed } from '../../../../../testing/configure-test-bed';
import {
  GamepadPadComponent,
  GamepadPadMode,
  GamepadPadHold
} from './gamepad-pad.component';

/** A pointer event on a pointer id, as jsdom has no PointerEvent. */
function pointer(type: string, pointerId: number): Event {
  const event = new MouseEvent(type, { bubbles: true, button: 0 });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  Object.defineProperty(event, 'pointerType', { value: 'touch' });
  return event;
}

describe('GamepadPadComponent', () => {
  const everything = gamepadControls({ face: 4, shoulders: 2, menu: 2 });
  let fixture: ComponentFixture<GamepadPadComponent>;
  let host: HTMLElement;
  let events: string[];
  let saves: number;

  function render(mode: GamepadPadMode, names: NameMap = {}): void {
    fixture = TestBed.createComponent(GamepadPadComponent);
    fixture.componentRef.setInput('controls', everything);
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('names', names);
    const pad = fixture.componentInstance;
    pad.pointerHold.subscribe(
      ({ pointerId, pressed, released }: GamepadPadHold) => {
        for (const control of released)
          events.push(`up ${control} ${pointerId}`);
        for (const control of pressed) {
          events.push(`down ${control} ${pointerId}`);
        }
      }
    );
    pad.save.subscribe(() => saves++);
    fixture.detectChanges();
    host = fixture.nativeElement as HTMLElement;
  }

  function button(control: string): HTMLButtonElement {
    return host.querySelector(`button[data-control="${control}"]`)!;
  }

  beforeEach(() => {
    configureTestBed([], [GamepadPadComponent]);
    events = [];
    saves = 0;
  });

  afterEach(() => {
    fixture.destroy();
  });

  describe('in names mode', () => {
    beforeEach(() => render('names', { a: 'Jump' }));

    it('presses nothing, whatever a pointer does on a control', () => {
      for (const control of everything) {
        button(control).dispatchEvent(pointer('pointerdown', 1));
        button(control).dispatchEvent(pointer('pointerup', 1));
      }
      expect(events).toEqual([]);
    });

    it('lists its name inputs in port order and keeps the controls out of Tab', () => {
      const inputs = [...host.querySelectorAll('input')];
      expect(inputs.map((input) => input.dataset['control'])).toEqual(
        everything
      );
      for (const control of everything) {
        expect(button(control).tabIndex).toBe(-1);
      }
    });

    it('writes an edit into the names and asks to save on Enter', () => {
      const input = host.querySelector<HTMLInputElement>(
        'input[data-control="up"]'
      )!;
      input.value = 'Fly';
      input.dispatchEvent(new Event('input'));
      expect(fixture.componentInstance.names()).toEqual({
        a: 'Jump',
        up: 'Fly'
      });

      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );
      expect(saves).toBe(1);
    });
  });

  describe('in play mode', () => {
    beforeEach(() => render('play'));

    it('holds one control per pointer, so two fingers hold two controls', () => {
      button('a').dispatchEvent(pointer('pointerdown', 1));
      button('start').dispatchEvent(pointer('pointerdown', 2));
      button('a').dispatchEvent(pointer('pointerup', 1));
      // Capture ends after the pointer has already let go.
      button('a').dispatchEvent(pointer('lostpointercapture', 1));
      button('start').dispatchEvent(pointer('pointercancel', 2));

      expect(events).toEqual([
        'down a 1',
        'down start 2',
        'up a 1',
        'up start 2'
      ]);
    });
  });
});
