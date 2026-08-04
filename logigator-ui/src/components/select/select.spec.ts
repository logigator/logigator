import { afterEach, describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { LgSelect } from './select';

interface Opt {
  label: string;
  value: number;
}

@Component({
  imports: [LgSelect, FormsModule],
  template: `
    <lg-select
      [options]="options"
      optionLabel="label"
      optionValue="value"
      [disabled]="disabled()"
      [ngModel]="selected()"
      (ngModelChange)="selected.set($event)"
      [ngModelOptions]="{ standalone: true }"
    />
  `
})
class HostComponent {
  readonly options: Opt[] = [
    { label: 'One', value: 1 },
    { label: 'Two', value: 2 },
    { label: 'Three', value: 3 }
  ];
  readonly selected = signal<number>(2);
  readonly disabled = signal(false);
}

function panelOptions(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      '.cdk-overlay-container [role=option]'
    )
  );
}

async function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
  const button = f.nativeElement.querySelector('button') as HTMLButtonElement;
  return { f, button };
}

describe('LgSelect', () => {
  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove());
  });

  it('renders the selected option label on the closed trigger', async () => {
    const { button } = await setup();
    expect(button.textContent).toContain('Two');
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens a listbox of options on click', async () => {
    const { f, button } = await setup();
    button.click();
    f.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(panelOptions().map((o) => o.textContent?.trim())).toEqual([
      'One',
      'Two',
      'Three'
    ]);
  });

  it('marks the matching option selected by primitive value (===), not by object identity', async () => {
    const { f, button } = await setup();
    button.click();
    f.detectChanges();
    const selected = panelOptions().filter(
      (o) => o.getAttribute('aria-selected') === 'true'
    );
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toContain('Two');
  });

  it('commits the chosen option value through ngModel and closes', async () => {
    const { f, button } = await setup();
    const host = f.componentInstance;
    button.click();
    f.detectChanges();
    panelOptions()[0].click();
    f.detectChanges();
    expect(host.selected()).toBe(1);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.textContent).toContain('One');
  });

  it('does not open when disabled', async () => {
    const { f, button } = await setup();
    f.componentInstance.disabled.set(true);
    f.detectChanges();
    button.click();
    f.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(panelOptions()).toHaveLength(0);
  });

  it('closes on backdrop (outside) click', async () => {
    const { f, button } = await setup();
    button.click();
    f.detectChanges();
    const backdrop = document.querySelector(
      '.cdk-overlay-backdrop'
    ) as HTMLElement;
    backdrop.click();
    f.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens on ArrowDown from the closed trigger', async () => {
    const { f, button } = await setup();
    button.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
    );
    f.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('selects the active option with Enter when open', async () => {
    const { f, button } = await setup();
    button.click();
    f.detectChanges();
    // Highlight the first option, then confirm it with Enter.
    panelOptions()[0].dispatchEvent(new MouseEvent('mouseenter'));
    f.detectChanges();
    button.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    f.detectChanges();
    expect(f.componentInstance.selected()).toBe(1);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('cancels the click a native button synthesises from Space keyup', async () => {
    const { button } = await setup();
    const event = new KeyboardEvent('keyup', {
      key: ' ',
      bubbles: true,
      cancelable: true
    });
    button.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

@Component({
  imports: [LgSelect, FormsModule],
  template: `
    <lg-select
      [options]="options"
      optionLabel="label"
      optionValue="value"
      optionIcon="icon"
      [ngModel]="selected()"
      (ngModelChange)="selected.set($event)"
      [ngModelOptions]="{ standalone: true }"
    />
  `
})
class IconHostComponent {
  readonly options = [
    { label: 'Light', value: 'l', icon: 'ph ph-sun' },
    { label: 'Dark', value: 'd', icon: 'ph ph-moon' }
  ];
  readonly selected = signal('l');
}

describe('LgSelect optionIcon', () => {
  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove());
  });

  it('shows the option icon on the closed trigger and in each row', async () => {
    const f = TestBed.createComponent(IconHostComponent);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    const button = f.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.querySelector('i')?.className).toContain('ph-sun');
    button.click();
    f.detectChanges();
    expect(panelOptions().map((o) => o.querySelector('i')?.className)).toEqual([
      expect.stringContaining('ph-sun'),
      expect.stringContaining('ph-moon')
    ]);
  });
});
