import { describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  formatShortcutKey,
  formatShortcutLabel,
  LgShortcut,
  LgShortcutBinding
} from './shortcut';

@Component({
  imports: [LgShortcut],
  template: `<lg-shortcut [binding]="binding()" [mac]="mac()" />`
})
class HostComponent {
  readonly binding = signal<LgShortcutBinding | null>({
    key: 's',
    ctrl: true
  });
  readonly mac = signal(false);
}

function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  const host = f.nativeElement as HTMLElement;
  return { f, host };
}

function chips(host: HTMLElement): string[] {
  return Array.from(host.querySelectorAll('kbd')).map(
    (k) => k.textContent?.trim() ?? ''
  );
}

describe('LgShortcut', () => {
  it('renders modifier and key chips joined by plus separators', () => {
    const { host } = setup();
    expect(chips(host)).toEqual(['Ctrl', 'S']);
    expect(host.textContent).toContain('+');
  });

  it('renders mac glyph chips without separators', () => {
    const { f, host } = setup();
    f.componentInstance.mac.set(true);
    f.componentInstance.binding.set({ key: 'z', ctrl: true, shift: true });
    f.detectChanges();
    expect(chips(host)).toEqual(['⇧', '⌘', 'Z']);
    expect(host.textContent).not.toContain('+');
  });

  it('renders an en dash for a null binding', () => {
    const { f, host } = setup();
    f.componentInstance.binding.set(null);
    f.detectChanges();
    expect(chips(host)).toEqual([]);
    expect(host.textContent).toContain('–');
  });

  it('formats special keys through the label map', () => {
    expect(formatShortcutKey('Escape')).toBe('Esc');
    expect(formatShortcutKey(' ')).toBe('Space');
    expect(formatShortcutKey('k')).toBe('K');
    expect(formatShortcutKey('F2')).toBe('F2');
  });

  it('formats a plain-string label per platform', () => {
    const binding: LgShortcutBinding = { key: 'z', ctrl: true, shift: true };
    expect(formatShortcutLabel(binding, false)).toBe('Ctrl+Shift+Z');
    expect(formatShortcutLabel(binding, true)).toBe('⇧⌘Z');
  });
});
