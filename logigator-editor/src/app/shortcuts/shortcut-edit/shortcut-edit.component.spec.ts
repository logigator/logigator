import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { ShortcutBinding } from '../shortcut-binding.model';
import { ShortcutEditComponent } from './shortcut-edit.component';

@Component({
  imports: [ShortcutEditComponent],
  template: `
    <div role="dialog" class="manager">
      <app-shortcut-edit [(binding)]="binding" />
    </div>
    <div role="dialog" class="stacked"><input /></div>
  `
})
class Host {
  readonly binding = signal<ShortcutBinding | null>(null);
}

describe('ShortcutEditComponent', () => {
  beforeEach(() => configureTestBed([], [Host]));

  afterEach(() => TestBed.resetTestingModule());

  function record() {
    const fixture = TestBed.createComponent(Host);
    document.body.appendChild(fixture.nativeElement as HTMLElement);
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector('.manager button') as HTMLElement
    ).click();
    fixture.detectChanges();
    return fixture;
  }

  function press(target: EventTarget, key: string): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  }

  it('records nothing typed into a dialog stacked over it, and keeps recording', () => {
    const fixture = record();
    press(fixture.nativeElement.querySelector('.stacked input'), 'k');
    expect(fixture.componentInstance.binding()).toBeNull();

    press(document.body, 'k');
    expect(fixture.componentInstance.binding()).toEqual({
      key: 'k',
      ctrl: false,
      shift: false,
      alt: false
    });
    (fixture.nativeElement as HTMLElement).remove();
  });
});
