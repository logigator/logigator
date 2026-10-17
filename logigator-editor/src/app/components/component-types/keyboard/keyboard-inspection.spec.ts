import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ApplicationRef,
  Component,
  inject,
  signal,
  WritableSignal
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LgWindowOutlet } from '@logigator/ui';
import { Subject } from 'rxjs';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { makeKeyboard } from '../../../../testing/factories';
import { InspectionSheetComponent } from '../../../inspection/inspection-sheet.component';
import { InspectionService } from '../../../inspection/inspection.service';
import { LayoutService } from '../../../layout/layout.service';
import { SimulationService } from '../../../simulation/simulation.service';
import { WorkModeService } from '../../../work-mode/work-mode.service';
import {
  INPUT_QUEUE_LIMIT,
  InputFrame,
  InputRoute
} from '../../component-inspection';
import { TranslationService } from '../../../translation/translation.service';
import {
  KEYBOARD_KEY_DOWN_OUTPUT,
  KEYBOARD_STROBE_OUTPUT
} from '@logigator/core';
import { cancelFrames, codeFromBits, readoutText } from './ascii';
import { KeyboardComponent } from './keyboard.component';
import { KeyboardInspection } from './keyboard-inspection';
import { KeyboardInspectionComponent } from './keyboard-inspection.component';

/**
 * What a frame does to the keyboard's outputs, in words: `press A` for a
 * code with the strobe, `release` for key down low. The frames on either
 * side of a press's strobe, its code on `D` without it, say nothing of
 * their own.
 */
function describeFrame(frame: InputFrame): string | null {
  const code = codeFromBits((bit) => frame.state[bit] === true);
  if (frame.state[KEYBOARD_STROBE_OUTPUT] === true) {
    return `press ${readoutText(code)}`;
  }
  return frame.state[KEYBOARD_KEY_DOWN_OUTPUT] === false ? 'release' : null;
}

/**
 * A route that records, in words, every frame sent through it, its input
 * holding `pendingEvents` event frames not yet applied.
 */
function recordingRoute(): InputRoute & {
  sent: string[];
  cancels: (readonly InputFrame[] | undefined)[];
  pendingEvents: number;
} {
  const route = {
    sent: [] as string[],
    cancels: [] as (readonly InputFrame[] | undefined)[],
    pendingEvents: 0,
    operate: () => undefined,
    send: (frames: readonly InputFrame[]) =>
      route.sent.push(...frames.flatMap((frame) => describeFrame(frame) ?? [])),
    cancel: (frames?: readonly InputFrame[]) => route.cancels.push(frames),
    pending: () => route.pendingEvents
  };
  return route;
}

function fakeSimulation(): {
  isReady: WritableSignal<boolean>;
  resets: WritableSignal<number>;
  frame$: Subject<void>;
} {
  return {
    isReady: signal(true),
    resets: signal(0),
    frame$: new Subject<void>()
  };
}

/** A key event on the focused element, as the browser dispatches it. */
function key(
  type: 'keydown' | 'keyup',
  code: string,
  keyValue: string,
  init: KeyboardEventInit = {}
): KeyboardEvent {
  const event = new KeyboardEvent(type, {
    code,
    key: keyValue,
    bubbles: true,
    cancelable: true,
    ...init
  });
  (document.activeElement ?? document.body).dispatchEvent(event);
  return event;
}

function paste(text: string): Event {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: (type: string) => (type === 'text/plain' ? text : '') }
  });
  (document.activeElement ?? document.body).dispatchEvent(event);
  return event;
}

describe('KeyboardInspectionComponent capture', () => {
  let keyboard: KeyboardComponent;
  let route: ReturnType<typeof recordingRoute>;
  let simulation: ReturnType<typeof fakeSimulation>;
  let inspection: KeyboardInspection;
  let fixture: ComponentFixture<KeyboardInspectionComponent>;
  let field: HTMLTextAreaElement;

  beforeEach(() => {
    simulation = fakeSimulation();
    configureTestBed(
      [{ provide: SimulationService, useValue: simulation }],
      [KeyboardInspectionComponent]
    );
    keyboard = makeKeyboard();
    route = recordingRoute();
    inspection = new KeyboardInspection(keyboard, route);
    fixture = TestBed.createComponent(KeyboardInspectionComponent);
    document.body.appendChild(fixture.nativeElement as HTMLElement);
    fixture.componentRef.setInput('inspection', inspection);
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    field = (fixture.nativeElement as HTMLElement).querySelector('textarea')!;
  });

  afterEach(() => {
    fixture.destroy();
    (fixture.nativeElement as HTMLElement).remove();
    keyboard.destroy({ children: true });
    TestBed.resetTestingModule();
  });

  it('takes the focus into its capture field when it opens', () => {
    expect(document.activeElement).toBe(field);
  });

  it('consumes an auto-repeat and sends nothing for it', () => {
    key('keydown', 'KeyA', 'a');
    const repeat = key('keydown', 'KeyA', 'a', { repeat: true });

    expect(repeat.defaultPrevented).toBe(true);
    expect(route.sent).toEqual(['press a']);
  });

  it('passes Ctrl, Meta and Alt combinations through', () => {
    const events = [
      key('keydown', 'KeyV', 'v', { ctrlKey: true }),
      key('keydown', 'KeyS', 's', { ctrlKey: true }),
      key('keydown', 'KeyC', 'c', { metaKey: true }),
      key('keydown', 'KeyF', 'f', { altKey: true })
    ];

    expect(events.map((e) => e.defaultPrevented)).toEqual([
      false,
      false,
      false,
      false
    ]);
    expect(route.sent).toEqual([]);
  });

  it('types the character AltGr makes, though the platform reports Ctrl+Alt', () => {
    const down = key('keydown', 'KeyQ', '@', {
      ctrlKey: true,
      altKey: true,
      modifierAltGraph: true
    } as KeyboardEventInit);

    expect(down.defaultPrevented).toBe(true);
    expect(route.sent).toEqual(['press @']);
  });

  it('sends Tab as TAB and keeps the focus, and lets Shift+Tab leave', () => {
    const tab = key('keydown', 'Tab', 'Tab');
    expect(tab.defaultPrevented).toBe(true);
    key('keyup', 'Tab', 'Tab');

    const back = key('keydown', 'Tab', 'Tab', { shiftKey: true });
    expect(back.defaultPrevented).toBe(false);
    expect(route.sent).toEqual(['press TAB', 'release']);
  });

  it('passes keys without a character through and consumes one outside ASCII', () => {
    expect(key('keydown', 'ArrowUp', 'ArrowUp').defaultPrevented).toBe(false);
    expect(key('keydown', 'F5', 'F5').defaultPrevented).toBe(false);
    expect(key('keydown', 'Quote', 'ä').defaultPrevented).toBe(true);
    expect(route.sent).toEqual([]);
  });

  it('leaves a key being composed to the text it produces', () => {
    const dead = key('keydown', 'BracketLeft', 'Dead');
    const ime = key('keydown', 'KeyA', 'Process');
    const composing = key('keydown', 'KeyB', 'b', { isComposing: true });

    expect([dead, ime, composing].map((e) => e.defaultPrevented)).toEqual([
      false,
      false,
      false
    ]);
    field.dispatchEvent(
      new CompositionEvent('compositionend', { data: 'b', bubbles: true })
    );
    expect(route.sent).toEqual(['press b', 'release']);
  });

  it('presses a key over a held one with no release between, and releases only once the last key is up', () => {
    key('keydown', 'KeyA', 'a');
    key('keydown', 'KeyB', 'b');
    key('keyup', 'KeyA', 'a');
    expect(route.sent).toEqual(['press a', 'press b']);
    expect(keyboard.heldKey()).toEqual({ code: 0x62, key: 'KeyB' });

    key('keyup', 'KeyB', 'b');
    expect(route.sent).toEqual(['press a', 'press b', 'release']);
    expect(keyboard.heldKey()).toBeNull();
  });

  it('keeps a key down when the key pressed over it goes up first', () => {
    key('keydown', 'KeyA', 'a');
    key('keydown', 'KeyB', 'b');
    key('keyup', 'KeyB', 'b');
    expect(route.sent).toEqual(['press a', 'press b']);
    // B's code stays on D, held down by A.
    expect(keyboard.heldKey()).toEqual({ code: 0x62, key: 'KeyB' });

    key('keyup', 'KeyA', 'a');
    expect(route.sent).toEqual(['press a', 'press b', 'release']);
  });

  it('highlights the character on D while any key is down', () => {
    key('keydown', 'KeyA', 'a');
    key('keydown', 'KeyB', 'b');
    const [, b] = inspection.history();
    key('keyup', 'KeyB', 'b');
    expect(inspection.heldEntry()).toBe(b.id);

    key('keyup', 'KeyA', 'a');
    expect(inspection.heldEntry()).toBeNull();
  });

  it('releases a shifted key by its code after Shift went up first', () => {
    key('keydown', 'ShiftLeft', 'Shift', { shiftKey: true });
    key('keydown', 'KeyA', 'A', { shiftKey: true });
    key('keyup', 'ShiftLeft', 'Shift');
    key('keyup', 'KeyA', 'a');

    expect(route.sent).toEqual(['press A', 'release']);
  });

  it('lets go of every key down when the field loses the focus', () => {
    key('keydown', 'KeyA', 'a');
    key('keydown', 'KeyB', 'b');
    field.blur();
    key('keyup', 'KeyA', 'a');
    key('keyup', 'KeyB', 'b');

    expect(route.sent).toEqual(['press a', 'press b', 'release']);
  });

  it('lets go of every key down when the page loses the focus', () => {
    key('keydown', 'KeyA', 'a');
    key('keydown', 'KeyB', 'b');
    window.dispatchEvent(new Event('blur'));

    expect(route.sent).toEqual(['press a', 'press b', 'release']);
  });

  it('taps every character of a paste', () => {
    const event = paste('ll');

    expect(event.defaultPrevented).toBe(true);
    expect(route.sent).toEqual(['press l', 'release', 'press l', 'release']);
  });

  it('lets a tap end with every key up, so the held key going up sends nothing', () => {
    key('keydown', 'KeyA', 'a');
    paste('x');
    key('keyup', 'KeyA', 'a');

    expect(route.sent).toEqual(['press a', 'press x', 'release']);
  });

  it('taps the text and the deletions a soft keyboard reports without a key', () => {
    for (const [inputType, data] of [
      ['insertText', 'ok'],
      ['insertLineBreak', null],
      ['deleteContentBackward', null],
      ['deleteContentForward', null]
    ] as const) {
      field.dispatchEvent(
        new InputEvent('beforeinput', {
          inputType,
          data,
          bubbles: true,
          cancelable: true
        })
      );
    }

    expect(route.sent).toEqual([
      'press o',
      'release',
      'press k',
      'release',
      'press LF',
      'release',
      'press BS',
      'release',
      'press DEL',
      'release'
    ]);
  });

  /** Opens Type text, enters `text` and returns the dialog's form. */
  function typeTextDialog(text: string): HTMLFormElement {
    fixture.componentInstance.openTypeText();
    TestBed.inject(ApplicationRef).tick();
    const dialogField =
      document.querySelector<HTMLTextAreaElement>('#type-text-field')!;
    dialogField.value = text;
    dialogField.dispatchEvent(new Event('input', { bubbles: true }));
    TestBed.inject(ApplicationRef).tick();
    return dialogField.form!;
  }

  function submitButton(form: HTMLFormElement): HTMLButtonElement {
    return form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  }

  it('sends the Type text dialog’s text as taps, read as a paste is', () => {
    const form = typeTextDialog('h\r\nä!');
    submitButton(form).click();
    TestBed.inject(ApplicationRef).tick();

    expect(route.sent).toEqual([
      'press h',
      'release',
      'press LF',
      'release',
      'press !',
      'release'
    ]);
    expect(document.querySelector('#type-text-field')).toBeNull();
    expect(document.activeElement).toBe(field);
  });

  it('offers nothing to send for a text without an ASCII character', () => {
    const form = typeTextDialog('äöü');

    expect(submitButton(form).disabled).toBe(true);
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(route.sent).toEqual([]);
  });

  /** Leaves room for `characters` more behind what the input holds. */
  function leaveRoom(characters: number): void {
    route.pendingEvents = INPUT_QUEUE_LIMIT - 3 * characters - 1;
    inspection.onFrame();
    TestBed.inject(ApplicationRef).tick();
  }

  /** The window's status line, where its notices replace the status. */
  function statusLine(): string {
    return (fixture.nativeElement as HTMLElement)
      .querySelector('[aria-live]')!
      .textContent!.trim();
  }

  it('refuses a paste or a key that does not fit behind the characters still being sent, whole, and asks to wait', () => {
    const refused = TestBed.inject(TranslationService).translate(
      'components.def.KEYBOARD.window.refused'
    );
    leaveRoom(2);

    paste('abc');
    TestBed.inject(ApplicationRef).tick();
    expect(route.sent).toEqual([]);
    expect(inspection.history()).toEqual([]);
    expect(statusLine()).toBe(refused);

    paste('ab');
    expect(route.sent).toEqual(['press a', 'release', 'press b', 'release']);

    leaveRoom(0);
    key('keydown', 'KeyD', 'd');
    key('keyup', 'KeyD', 'd');
    expect(route.sent).toHaveLength(4);
    expect(keyboard.heldKey()).toBeNull();
  });

  it('holds back a Type text send that does not fit, saying so, until the characters ahead have gone out', () => {
    const doesNotFit = TestBed.inject(TranslationService).translate(
      'components.def.KEYBOARD.typeText.doesNotFit'
    );
    leaveRoom(2);
    const form = typeTextDialog('abc');

    expect(submitButton(form).disabled).toBe(true);
    expect(form.textContent).toContain(doesNotFit);
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(route.sent).toEqual([]);

    leaveRoom(3);
    expect(form.textContent).not.toContain(doesNotFit);
    submitButton(form).click();
    TestBed.inject(ApplicationRef).tick();
    expect(route.sent).toEqual([
      'press a',
      'release',
      'press b',
      'release',
      'press c',
      'release'
    ]);
  });

  it('forgets the history and the held key once a stop rebuilds the engine', () => {
    key('keydown', 'KeyA', 'a');
    expect(inspection.history()).toHaveLength(1);

    simulation.resets.set(1);
    inspection.onFrame();
    key('keyup', 'KeyA', 'a');

    expect(inspection.history()).toEqual([]);
    expect(route.sent).toEqual(['press a']);
  });
});

describe('KeyboardInspection', () => {
  let keyboard: KeyboardComponent;
  let route: ReturnType<typeof recordingRoute>;
  let inspection: KeyboardInspection;

  beforeEach(() => {
    configureTestBed([
      { provide: SimulationService, useValue: fakeSimulation() }
    ]);
    keyboard = makeKeyboard();
    route = recordingRoute();
    inspection = new KeyboardInspection(keyboard, route);
  });

  afterEach(() => {
    keyboard.destroy({ children: true });
  });

  it('cancels in place of what is queued, letting go of every key down', () => {
    inspection.press('KeyA', 0x61);
    inspection.press('KeyB', 0x62);
    inspection.cancel();
    inspection.release('KeyA');
    inspection.release('KeyB');

    expect(route.cancels).toEqual([cancelFrames()]);
    expect(route.sent).toEqual(['press a', 'press b']);
    expect(keyboard.heldKey()).toBeNull();
  });

  it('lets go of every key it pressed when it closes, and of no other', () => {
    inspection.press('KeyA', 0x61);
    keyboard.pressKey(route, 0x62);
    inspection.destroy();
    expect(route.sent).toEqual(['press a', 'press b']);
    expect(keyboard.heldKey()).toEqual({ code: 0x62, key: null });

    keyboard.releaseKeys(route);
    expect(route.sent).toEqual(['press a', 'press b', 'release']);
  });

  it('keeps the last 64 characters sent, oldest first', () => {
    inspection.type(Array.from({ length: 70 }, (_, i) => 0x21 + i));

    const codes = inspection.history().map((entry) => entry.code);
    expect(codes).toEqual(Array.from({ length: 64 }, (_, i) => 0x21 + 6 + i));
  });
});

/** The two frames the keyboard's view opens in, by breakpoint. */
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

describe('KeyboardInspectionComponent in its frame', () => {
  let keyboard: KeyboardComponent;
  let route: ReturnType<typeof recordingRoute>;
  let compact: WritableSignal<boolean>;
  let fixture: ComponentFixture<PresentationHost>;
  let inspections: InspectionService;

  function settle(): void {
    for (let i = 0; i < 3; i++) TestBed.inject(ApplicationRef).tick();
  }

  function open(): void {
    fixture = TestBed.createComponent(PresentationHost);
    document.body.appendChild(fixture.nativeElement as HTMLElement);
    settle();
    inspections.openFor(keyboard, { input: route });
    settle();
  }

  beforeEach(() => {
    compact = signal(false);
    configureTestBed(
      [
        { provide: SimulationService, useValue: fakeSimulation() },
        {
          provide: LayoutService,
          useValue: { isCompact: compact, isTouch: signal(false) }
        }
      ],
      [PresentationHost]
    );
    TestBed.inject(WorkModeService).setSimulationMode(true);
    inspections = TestBed.inject(InspectionService);
    keyboard = makeKeyboard();
    route = recordingRoute();
  });

  afterEach(() => {
    inspections.closeAll();
    fixture.destroy();
    (fixture.nativeElement as HTMLElement).remove();
    keyboard.destroy({ children: true });
    TestBed.resetTestingModule();
  });

  for (const layout of ['window', 'sheet'] as const) {
    it(`sends Escape to the circuit and keeps the ${layout} open`, () => {
      compact.set(layout === 'sheet');
      open();
      const field = document.querySelector<HTMLTextAreaElement>(
        'app-keyboard-inspection textarea'
      )!;
      expect(document.activeElement).toBe(field);

      const escape = key('keydown', 'Escape', 'Escape');
      settle();

      expect(escape.defaultPrevented).toBe(true);
      expect(route.sent).toEqual(['press ESC']);
      expect(inspections.open()).toHaveLength(1);
      expect(document.querySelector('app-keyboard-inspection')).not.toBeNull();
    });
  }
});
