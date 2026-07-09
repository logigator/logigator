import { describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LgButton } from './button';

function create(): ComponentFixture<LgButton> {
  return TestBed.createComponent(LgButton);
}

function button(f: ComponentFixture<LgButton>): HTMLButtonElement {
  return f.nativeElement.querySelector('button') as HTMLButtonElement;
}

describe('LgButton', () => {
  it('renders an icon-only button (no label span) when label is omitted', () => {
    const f = create();
    f.componentRef.setInput('icon', 'ph ph-trash');
    f.detectChanges();
    expect(f.nativeElement.querySelector('span')).toBeNull();
    expect(f.nativeElement.querySelector('i')?.className).toContain('ph-trash');
    // icon-only square sizing lives on the host
    expect((f.nativeElement as HTMLElement).className).toContain('size-10');
  });

  it('emits onClick when clicked', () => {
    const f = create();
    const spy = vi.fn();
    f.componentInstance.onClick.subscribe(spy);
    f.detectChanges();
    button(f).click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not emit onClick when disabled', () => {
    const f = create();
    f.componentRef.setInput('disabled', true);
    const spy = vi.fn();
    f.componentInstance.onClick.subscribe(spy);
    f.detectChanges();
    button(f).click();
    expect(spy).not.toHaveBeenCalled();
    expect(button(f).disabled).toBe(true);
  });

  it('shows a spinner and force-disables while loading', () => {
    const f = create();
    f.componentRef.setInput('label', 'Save');
    f.componentRef.setInput('loading', true);
    f.detectChanges();
    expect(button(f).disabled).toBe(true);
    expect(f.nativeElement.querySelector('.animate-spin')).not.toBeNull();
  });
});
