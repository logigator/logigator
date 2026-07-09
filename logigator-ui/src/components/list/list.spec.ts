import { describe, expect, it } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgList, LgListItem } from './list';

@Component({
  imports: [LgList, LgListItem],
  template: `
    <lg-list>
      <lg-list-item>
        <ng-template #leading><i class="ph ph-circuitry"></i></ng-template>
        8-bit Adder
        <ng-template #subtitle>Edited 2 minutes ago</ng-template>
        <ng-template #trailing><span class="tag">Unsaved</span></ng-template>
      </lg-list-item>
      <lg-list-item>SR Latch</lg-list-item>
    </lg-list>
  `
})
class HostComponent {}

describe('LgList', () => {
  it('renders a plain single-line row when no slots are filled', () => {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const second = el.querySelectorAll('lg-list-item')[1] as HTMLElement;
    expect(second.textContent?.trim()).toBe('SR Latch');
    expect(second.querySelector('.ph')).toBeNull();
  });

  it('renders the leadingIcon shorthand, with the #leading template winning', () => {
    @Component({
      imports: [LgList, LgListItem],
      template: `
        <lg-list>
          <lg-list-item leadingIcon="ph ph-file">Shorthand</lg-list-item>
          <lg-list-item leadingIcon="ph ph-file">
            <ng-template #leading><i class="ph ph-circuitry"></i></ng-template>
            Template wins
          </lg-list-item>
        </lg-list>
      `
    })
    class IconHost {}
    const f = TestBed.createComponent(IconHost);
    f.detectChanges();
    const items = (f.nativeElement as HTMLElement).querySelectorAll(
      'lg-list-item'
    );
    // Shorthand renders the glyph from the input.
    expect(items[0].querySelector('i.ph-file')).not.toBeNull();
    // The template slot takes precedence over the shorthand.
    expect(items[1].querySelector('i.ph-circuitry')).not.toBeNull();
    expect(items[1].querySelector('i.ph-file')).toBeNull();
  });

  // Mirrors the logout dialog exactly: each row decides its subtitle with a
  // per-item `@if`, so the template lives in a conditionally-created view. Rows
  // that provide it must render it; rows that don't must stay single-line.
  it('resolves per-row subtitle slots wrapped in @if', () => {
    @Component({
      imports: [LgList, LgListItem],
      template: `
        <lg-list>
          @for (row of rows; track row.name) {
            <lg-list-item>
              {{ row.name }}
              @if (row.edited) {
                <ng-template #subtitle>{{ row.edited }}</ng-template>
              }
            </lg-list-item>
          }
        </lg-list>
      `
    })
    class RowsHost {
      rows = [
        { name: 'With time', edited: 'Edited just now' },
        { name: 'No time', edited: '' }
      ];
    }
    const f = TestBed.createComponent(RowsHost);
    f.detectChanges();
    const items = (f.nativeElement as HTMLElement).querySelectorAll(
      'lg-list-item'
    );
    expect(items[0].textContent).toContain('Edited just now');
    expect(items[1].textContent).toContain('No time');
    expect(items[1].textContent).not.toContain('Edited');
  });
});
