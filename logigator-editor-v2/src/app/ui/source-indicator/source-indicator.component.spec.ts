import { describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  SourceIndicatorComponent,
  SourceIndicatorState
} from './source-indicator.component';

@Component({
  imports: [SourceIndicatorComponent],
  template: `<app-source-indicator
    [source]="source()"
    [variant]="variant()"
    draftTitle="unsaved!"
  />`
})
class HostComponent {
  readonly source = signal<SourceIndicatorState>('server');
  readonly variant = signal<'chip' | 'badge'>('chip');
}

function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  return f;
}

describe('SourceIndicatorComponent', () => {
  it('labels each state distinctly in the chip variant', () => {
    const f = setup();
    const text = () =>
      (f.nativeElement.textContent as string).replace(/\s+/g, ' ').trim();

    f.componentInstance.source.set('server');
    f.detectChanges();
    expect(text()).toBe('Cloud');

    f.componentInstance.source.set('browser');
    f.detectChanges();
    expect(text()).toBe('Local');

    f.componentInstance.source.set('draft');
    f.detectChanges();
    expect(text()).toBe('Unsaved');

    f.componentInstance.source.set('share');
    f.detectChanges();
    expect(text()).toBe('Shared');
  });

  it('uses the per-state tooltip override', () => {
    const f = setup();
    f.componentInstance.source.set('draft');
    f.detectChanges();
    const el = f.nativeElement.querySelector('[title]') as HTMLElement;
    expect(el.getAttribute('title')).toBe('unsaved!');
  });

  it('renders a corner glyph (no label) in the badge variant', () => {
    const f = setup();
    f.componentInstance.variant.set('badge');
    f.componentInstance.source.set('share');
    f.detectChanges();
    expect((f.nativeElement.textContent as string).trim()).toBe('');
    expect(f.nativeElement.querySelector('i.ph-share-network')).toBeTruthy();
  });
});
