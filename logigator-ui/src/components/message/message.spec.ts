import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LgMessage } from './message';

describe('LgMessage', () => {
  it('tints the banner and picks the default icon for its severity', () => {
    const f = TestBed.createComponent(LgMessage);
    f.componentRef.setInput('severity', 'warn');
    f.detectChanges();
    const div = f.nativeElement.querySelector('div') as HTMLElement;
    const icon = f.nativeElement.querySelector('i') as HTMLElement;
    expect(div.className).toContain('bg-warn-surface');
    expect(div.className).toContain('items-center');
    expect(icon.className).toContain('ph-warning');
  });

  it('renders borderless and muted for the none severity by default', () => {
    const f = TestBed.createComponent(LgMessage);
    f.detectChanges();
    const div = f.nativeElement.querySelector('div') as HTMLElement;
    expect(div.className).toContain('border-transparent');
    expect(div.className).toContain('text-muted');
  });

  it('stacks the icon above centered text when centered', () => {
    const f = TestBed.createComponent(LgMessage);
    f.componentRef.setInput('centered', true);
    f.detectChanges();
    const div = f.nativeElement.querySelector('div') as HTMLElement;
    const icon = f.nativeElement.querySelector('i') as HTMLElement;
    expect(div.className).toContain('flex-col');
    expect(div.className).toContain('text-center');
    expect(icon.className).toContain('text-3xl');
  });

  it('renders the danger severity on the error palette', () => {
    const f = TestBed.createComponent(LgMessage);
    f.componentRef.setInput('severity', 'danger');
    f.detectChanges();
    const div = f.nativeElement.querySelector('div') as HTMLElement;
    const icon = f.nativeElement.querySelector('i') as HTMLElement;
    expect(div.className).toContain('bg-error-surface');
    expect(div.className).toContain('text-error');
    expect(icon.className).toContain('ph-x-circle');
  });

  it('overrides the default icon with the icon input', () => {
    const f = TestBed.createComponent(LgMessage);
    f.componentRef.setInput('severity', 'info');
    f.componentRef.setInput('icon', 'ph-rocket');
    f.detectChanges();
    const icon = f.nativeElement.querySelector('i') as HTMLElement;
    expect(icon.className).toContain('ph-rocket');
    expect(icon.className).not.toContain('ph-info');
  });
});