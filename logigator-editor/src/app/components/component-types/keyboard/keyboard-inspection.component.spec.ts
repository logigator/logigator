import { afterEach, describe, expect, it } from 'vitest';
import { ApplicationRef, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { makeKeyboard } from '../../../../testing/factories';
import { LayoutService } from '../../../layout/layout.service';
import { SimulationService } from '../../../simulation/simulation.service';
import { TranslationService } from '../../../translation/translation.service';
import { InputRoute } from '../../component-inspection';
import { KeyboardComponent } from './keyboard.component';
import { KeyboardInspection } from './keyboard-inspection';
import { KeyboardInspectionComponent } from './keyboard-inspection.component';

const silentRoute: InputRoute = {
  press: () => undefined,
  release: () => undefined,
  send: () => undefined,
  cancel: () => undefined,
  pending: () => 0
};

describe('KeyboardInspectionComponent focus by layout', () => {
  let keyboard: KeyboardComponent;
  let fixture: ComponentFixture<KeyboardInspectionComponent>;
  let field: HTMLTextAreaElement;

  function open(layout: { compact: boolean; touch: boolean }): void {
    configureTestBed(
      [
        {
          provide: SimulationService,
          useValue: {
            isReady: signal(true),
            resets: signal(0),
            frame$: new Subject<void>()
          }
        },
        {
          provide: LayoutService,
          useValue: {
            isCompact: signal(layout.compact),
            isTouch: signal(layout.touch)
          }
        }
      ],
      [KeyboardInspectionComponent]
    );
    keyboard = makeKeyboard();
    fixture = TestBed.createComponent(KeyboardInspectionComponent);
    document.body.appendChild(fixture.nativeElement as HTMLElement);
    fixture.componentRef.setInput(
      'inspection',
      new KeyboardInspection(keyboard, silentRoute)
    );
    settle();
    field = (fixture.nativeElement as HTMLElement).querySelector('textarea')!;
  }

  function settle(): void {
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
  }

  function asksForTap(): boolean {
    const hint = TestBed.inject(TranslationService).translate(
      'components.def.KEYBOARD.window.tapToType'
    );
    return (fixture.nativeElement as HTMLElement).textContent!.includes(hint);
  }

  afterEach(() => {
    fixture.destroy();
    (fixture.nativeElement as HTMLElement).remove();
    keyboard.destroy({ children: true });
    TestBed.resetTestingModule();
  });

  it('on a compact touch layout, leaves the focus to a tap and asks for one exactly while the field lacks it', () => {
    open({ compact: true, touch: true });
    expect(document.activeElement).not.toBe(field);
    expect(asksForTap()).toBe(true);

    field.focus();
    settle();
    expect(asksForTap()).toBe(false);

    field.blur();
    settle();
    expect(asksForTap()).toBe(true);
  });

  for (const layout of [
    { compact: false, touch: true },
    { compact: true, touch: false },
    { compact: false, touch: false }
  ]) {
    it(`takes the focus on opening and never asks for a tap (compact: ${layout.compact}, touch: ${layout.touch})`, () => {
      open(layout);
      expect(document.activeElement).toBe(field);
      expect(asksForTap()).toBe(false);

      field.blur();
      settle();
      expect(asksForTap()).toBe(false);
    });
  }

  it('keeps the caret after the sentinel when a tap places it in front', () => {
    open({ compact: true, touch: true });
    field.focus();
    field.setSelectionRange(0, 0);
    field.click();
    expect(field.selectionStart).toBe(field.value.length);
    expect(field.value.length).toBeGreaterThan(0);
  });
});
