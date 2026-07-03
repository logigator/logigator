import { afterEach, describe, expect, it } from 'vitest';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgTooltip } from './tooltip';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LgTooltip],
  template: `<button [lgTooltip]="text()" tooltipPosition="bottom">x</button>`
})
class HostComponent {
  readonly text = signal<string>('hello tip');
}

function overlayText(): string {
  return document.querySelector('.cdk-overlay-container')?.textContent ?? '';
}

function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  const button = f.nativeElement.querySelector('button') as HTMLButtonElement;
  return { f, button };
}

describe('LgTooltip', () => {
  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove());
  });

  it('shows the bubble on hover and removes it on leave', () => {
    const { f, button } = setup();
    button.dispatchEvent(new MouseEvent('mouseenter'));
    f.detectChanges();
    expect(overlayText()).toContain('hello tip');

    button.dispatchEvent(new MouseEvent('mouseleave'));
    f.detectChanges();
    expect(overlayText()).not.toContain('hello tip');
  });

  it('registers the text for screen readers (aria-describedby)', () => {
    const { button } = setup();
    expect(button.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('is a no-op when the content is empty', () => {
    const { f, button } = setup();
    f.componentInstance.text.set('');
    f.detectChanges();
    button.dispatchEvent(new MouseEvent('mouseenter'));
    f.detectChanges();
    expect(overlayText()).toBe('');
  });

  it('renders a shortcut as kbd chips and describes it for screen readers', () => {
    @Component({
      changeDetection: ChangeDetectionStrategy.OnPush,
      imports: [LgTooltip],
      template: `<button lgTooltip="Save" [tooltipShortcut]="shortcut">
        x
      </button>`
    })
    class ShortcutHostComponent {
      readonly shortcut = { key: 's', ctrl: true };
    }
    const f = TestBed.createComponent(ShortcutHostComponent);
    f.detectChanges();
    const button = f.nativeElement.querySelector('button') as HTMLButtonElement;
    button.dispatchEvent(new MouseEvent('mouseenter'));
    f.detectChanges();
    const chips = Array.from(
      document.querySelectorAll('.cdk-overlay-container kbd')
    ).map((k) => k.textContent?.trim());
    expect(chips).toEqual(['Ctrl', 'S']);

    const describedBy = button.getAttribute('aria-describedby')!;
    const description = document.getElementById(describedBy.split(' ')[0]);
    expect(description?.textContent).toContain('Save (Ctrl+S)');
  });
});
