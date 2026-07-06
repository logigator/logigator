import { describe, expect, it } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgCard } from './card';

@Component({
  imports: [LgCard],
  template: `
    <lg-card>
      <ng-template #title>My title</ng-template>
      <ng-template #subtitle>My subtitle</ng-template>
      <p class="body">Body content</p>
    </lg-card>
  `
})
class HostComponent {}

describe('LgCard', () => {
  it('renders the title, subtitle and body', () => {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    const text = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('My title');
    expect(text).toContain('My subtitle');
    expect(f.nativeElement.querySelector('.body')?.textContent).toContain(
      'Body content'
    );
  });

  it('omits the title/subtitle slots when not provided', () => {
    @Component({
      imports: [LgCard],
      template: `<lg-card>just body</lg-card>`
    })
    class BareHost {}
    const f = TestBed.createComponent(BareHost);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).toContain('just body');
  });
});
