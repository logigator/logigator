import { describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { LgSelectButton } from './select-button';

@Component({
  imports: [LgSelectButton, FormsModule],
  template: `<lg-select-button
    [options]="options"
    optionLabel="label"
    optionValue="value"
    [allowEmpty]="allowEmpty()"
    [ngModel]="value()"
    (ngModelChange)="value.set($event)"
  >
    <ng-template #item let-o>icon:{{ o.value }}</ng-template>
  </lg-select-button>`
})
class HostComponent {
  readonly options = [
    { label: 'East', value: 'e' },
    { label: 'West', value: 'w' }
  ];
  readonly allowEmpty = signal(false);
  readonly value = signal<string | undefined>('e');
}

async function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
  const buttons = Array.from(
    f.nativeElement.querySelectorAll('button')
  ) as HTMLButtonElement[];
  return { f, buttons };
}

describe('LgSelectButton', () => {
  it('renders an option per entry and marks the selected one', async () => {
    const { buttons } = await setup();
    expect(buttons).toHaveLength(2);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
  });

  it('projects the #item template with the option as $implicit', async () => {
    const { buttons } = await setup();
    expect(buttons[0].textContent).toContain('icon:e');
  });

  it('writes the optionValue primitive on click', async () => {
    const { f, buttons } = await setup();
    buttons[1].click();
    expect(f.componentInstance.value()).toBe('w');
  });

  it('does not clear when clicking the active option (allowEmpty=false)', async () => {
    const { f, buttons } = await setup();
    buttons[0].click();
    expect(f.componentInstance.value()).toBe('e');
  });

  it('clears when allowEmpty and the active option is clicked', async () => {
    const { f, buttons } = await setup();
    f.componentInstance.allowEmpty.set(true);
    f.detectChanges();
    buttons[0].click();
    expect(f.componentInstance.value()).toBeUndefined();
  });
});

@Component({
  imports: [LgSelectButton, FormsModule],
  template: `<lg-select-button
    [options]="options"
    optionLabel="label"
    optionValue="value"
    optionIcon="icon"
    [ngModel]="value()"
    (ngModelChange)="value.set($event)"
  />`
})
class IconHostComponent {
  readonly options = [
    { label: 'Sun', value: 'light', icon: 'ph ph-sun' },
    { label: 'Moon', value: 'dark' }
  ];
  readonly value = signal('light');
}

describe('LgSelectButton optionIcon', () => {
  it('renders the option icon + label without an #item template', async () => {
    const f = TestBed.createComponent(IconHostComponent);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    const buttons = Array.from(
      f.nativeElement.querySelectorAll('button')
    ) as HTMLButtonElement[];
    expect(buttons[0].querySelector('i')?.className).toContain('ph-sun');
    expect(buttons[0].textContent).toContain('Sun');
    // an option without an icon field renders just its label
    expect(buttons[1].querySelector('i')).toBeNull();
    expect(buttons[1].textContent).toContain('Moon');
  });
});
