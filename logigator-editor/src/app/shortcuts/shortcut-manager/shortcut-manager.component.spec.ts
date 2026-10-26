import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { DialogRef } from '@logigator/ui';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { TranslationService } from '../../translation/translation.service';
import { ShortcutService } from '../shortcut.service';
import { ShortcutActionEnum } from '../shortcut-action.enum';
import { DEFAULT_SHORTCUTS, ShortcutBinding } from '../shortcut-binding.model';
import { ShortcutEditComponent } from '../shortcut-edit/shortcut-edit.component';
import { ShortcutManagerComponent } from './shortcut-manager.component';

describe('ShortcutManagerComponent', () => {
  let fixture: ComponentFixture<ShortcutManagerComponent>;
  let el: HTMLElement;
  let shortcuts: ShortcutService;
  let translation: TranslationService;

  beforeEach(async () => {
    localStorage.removeItem('logigator.shortcuts');
    configureTestBed([{ provide: DialogRef, useValue: new DialogRef() }]);
    translation = TestBed.inject(TranslationService);
    await firstValueFrom(TestBed.inject(TranslocoService).load('en'));
    shortcuts = TestBed.inject(ShortcutService);
    fixture = TestBed.createComponent(ShortcutManagerComponent);
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  /** The row's own recorder, found by the action's label beside it. */
  function rebind(action: ShortcutActionEnum, binding: ShortcutBinding): void {
    const label = translation.translate(`shortcuts.actions.${action}`);
    const edit = fixture.debugElement
      .queryAll(By.directive(ShortcutEditComponent))
      .find((de) =>
        de.nativeElement
          .closest('.justify-between')
          ?.textContent?.trim()
          .startsWith(label)
      );
    edit!.triggerEventHandler('bindingChange', binding);
    fixture.detectChanges();
  }

  function hints(): HTMLElement[] {
    return Array.from(el.querySelectorAll<HTMLElement>('.taken-hint'));
  }

  function announced(): string {
    return el.querySelector('[aria-live]')!.textContent!.trim();
  }

  function takenFromSave(): string {
    return translation.translate('shortcuts.manager.takenFrom', {
      action: translation.translate('shortcuts.actions.save')
    });
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tells a taken binding in a hint over the dialog, not in a toast', () => {
    rebind(ShortcutActionEnum.COPY, DEFAULT_SHORTCUTS[ShortcutActionEnum.SAVE]);

    expect(shortcuts.binding(ShortcutActionEnum.SAVE)()).toBeNull();
    expect(hints().map((hint) => hint.textContent!.trim())).toEqual([
      takenFromSave()
    ]);
    expect(announced()).toBe(takenFromSave());
  });

  it('drops the hint on the next change', () => {
    rebind(ShortcutActionEnum.COPY, DEFAULT_SHORTCUTS[ShortcutActionEnum.SAVE]);
    rebind(ShortcutActionEnum.SAVE, {
      key: 'q',
      ctrl: false,
      shift: false,
      alt: false
    });

    expect(hints()).toEqual([]);
    expect(announced()).toBe('');
  });

  it('drops the hint after a few seconds', () => {
    vi.useFakeTimers();
    rebind(ShortcutActionEnum.COPY, DEFAULT_SHORTCUTS[ShortcutActionEnum.SAVE]);

    vi.advanceTimersByTime(3999);
    fixture.detectChanges();
    expect(hints()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(hints()).toEqual([]);
  });
});
