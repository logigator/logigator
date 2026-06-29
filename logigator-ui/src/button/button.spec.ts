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
  it('renders the label', () => {
    const f = create();
    f.componentRef.setInput('label', 'Save');
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Save');
  });

  it('renders an icon-only button (no label span) when label is omitted', () => {
    const f = create();
    f.componentRef.setInput('icon', 'ph ph-trash');
    f.detectChanges();
    expect(f.nativeElement.querySelector('span')).toBeNull();
    expect(f.nativeElement.querySelector('i')?.className).toContain('ph-trash');
    // icon-only sizing
    expect(button(f).className).toContain('w-10');
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

  it('applies small-size classes', () => {
    const f = create();
    f.componentRef.setInput('label', 'X');
    f.componentRef.setInput('size', 'small');
    f.detectChanges();
    expect(button(f).className).toContain('text-sm');
    expect(button(f).className).toContain('px-2.5');
  });

  it('applies the secondary severity classes', () => {
    const f = create();
    f.componentRef.setInput('label', 'X');
    f.componentRef.setInput('severity', 'secondary');
    f.detectChanges();
    expect(button(f).className).toContain('bg-surface-100');
  });

  it('switches to outlined and text variants', () => {
    const f = create();
    f.componentRef.setInput('label', 'X');
    f.componentRef.setInput('outlined', true);
    f.detectChanges();
    expect(button(f).className).toContain('border-primary-200');

    f.componentRef.setInput('outlined', false);
    f.componentRef.setInput('text', true);
    f.detectChanges();
    expect(button(f).className).not.toContain('border-primary-200');
    expect(button(f).className).toContain('text-primary');
  });

  it('reflects type and ariaLabel', () => {
    const f = create();
    f.componentRef.setInput('type', 'submit');
    f.componentRef.setInput('ariaLabel', 'Save project');
    f.detectChanges();
    expect(button(f).getAttribute('type')).toBe('submit');
    expect(button(f).getAttribute('aria-label')).toBe('Save project');
  });

  it('merges styleClass onto the button', () => {
    const f = create();
    f.componentRef.setInput('label', 'X');
    f.componentRef.setInput('styleClass', 'w-full');
    f.detectChanges();
    expect(button(f).className).toContain('w-full');
  });
});
