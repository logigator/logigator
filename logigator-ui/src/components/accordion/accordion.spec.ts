import { describe, expect, it } from 'vitest';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgAccordion, LgAccordionPanel } from './accordion';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LgAccordion, LgAccordionPanel],
  template: `<lg-accordion
    [multiple]="multiple()"
    [value]="open()"
    (valueChange)="open.set($event)"
  >
    <lg-accordion-panel value="a">
      <ng-template #header>Header A</ng-template>
      <div>Body A</div>
    </lg-accordion-panel>
    <lg-accordion-panel value="b">
      <ng-template #header>Header B</ng-template>
      <div>Body B</div>
    </lg-accordion-panel>
  </lg-accordion>`
})
class HostComponent {
  readonly multiple = signal(true);
  readonly open = signal<string[]>([]);
}

function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  const headers = Array.from(
    f.nativeElement.querySelectorAll('button')
  ) as HTMLButtonElement[];
  return { f, headers };
}

describe('LgAccordion', () => {
  it('renders the header templates collapsed by default', () => {
    const { headers } = setup();
    expect(headers[0].textContent).toContain('Header A');
    expect(headers[0].getAttribute('aria-expanded')).toBe('false');
  });

  it('opens a panel on header click (model updates)', () => {
    const { f, headers } = setup();
    headers[0].click();
    f.detectChanges();
    expect(f.componentInstance.open()).toEqual(['a']);
    expect(headers[0].getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps multiple panels open when multiple=true', () => {
    const { f, headers } = setup();
    headers[0].click();
    headers[1].click();
    f.detectChanges();
    expect(f.componentInstance.open()).toEqual(['a', 'b']);
  });

  it('closes others when multiple=false', () => {
    const { f, headers } = setup();
    f.componentInstance.multiple.set(false);
    f.detectChanges();
    headers[0].click();
    headers[1].click();
    f.detectChanges();
    expect(f.componentInstance.open()).toEqual(['b']);
  });

  it('toggles a panel closed when its header is clicked again', () => {
    const { f, headers } = setup();
    headers[0].click();
    headers[0].click();
    f.detectChanges();
    expect(f.componentInstance.open()).toEqual([]);
  });
});
