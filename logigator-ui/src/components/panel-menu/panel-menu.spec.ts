import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LgPanelMenu } from './panel-menu';
import { MenuItem } from '../menu/menu-item.model';

function setup(model: MenuItem[]) {
  const f = TestBed.createComponent(LgPanelMenu);
  f.componentRef.setInput('model', model);
  f.detectChanges();
  const buttons = () =>
    Array.from(
      f.nativeElement.querySelectorAll('button')
    ) as HTMLButtonElement[];
  return { f, buttons };
}

describe('LgPanelMenu', () => {
  it('dispatches a leaf item command', () => {
    const command = vi.fn();
    const { buttons } = setup([{ label: 'New', command }]);
    buttons()[0].click();
    expect(command).toHaveBeenCalledOnce();
  });

  it('expands a parent to reveal and run children', () => {
    const command = vi.fn();
    const { f, buttons } = setup([
      { label: 'File', items: [{ label: 'Open', command }] }
    ]);
    // collapsed: only the parent button is interactive
    const parent = buttons()[0];
    expect(parent.getAttribute('aria-expanded')).toBe('false');
    parent.click();
    f.detectChanges();
    expect(parent.getAttribute('aria-expanded')).toBe('true');

    const child = buttons().find((b) => b.textContent?.includes('Open'))!;
    child.click();
    expect(command).toHaveBeenCalledOnce();
  });

  it('renders a separator and skips hidden items', () => {
    const { f } = setup([
      { label: 'A', command: () => undefined },
      { separator: true },
      { label: 'Hidden', visible: false, command: () => undefined }
    ]);
    expect(f.nativeElement.querySelector('lg-divider')).toBeTruthy();
    expect(f.nativeElement.textContent).not.toContain('Hidden');
  });

  it('disables an item flagged disabled', () => {
    const { buttons } = setup([
      { label: 'X', disabled: true, command: () => undefined }
    ]);
    expect(buttons()[0].disabled).toBe(true);
  });
});
