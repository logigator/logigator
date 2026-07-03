import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgMenubar } from './menubar';
import { MenuItem } from './menu-item.model';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LgMenubar],
  template: `
    <lg-menubar [model]="items()">
      <ng-template #start><span class="brand">LOGO</span></ng-template>
      <ng-template #end><span class="user">USER</span></ng-template>
      <ng-template #item let-item let-root="root">
        <span class="row" [attr.data-root]="root">{{ item.label }}</span>
      </ng-template>
    </lg-menubar>
  `
})
class HostComponent {
  readonly undo = vi.fn();
  readonly help = vi.fn();
  readonly items = signal<MenuItem[]>([
    {
      label: 'Edit',
      items: [
        { label: 'Undo', command: () => this.undo() },
        { separator: true },
        { label: 'Redo' }
      ]
    },
    {
      label: 'View',
      items: [{ label: 'Zoom In' }]
    },
    { label: 'Help', command: () => this.help() }
  ]);
}

function container(): Element | null {
  return document.querySelector('.cdk-overlay-container');
}

function openMenu(): Element | null {
  return document.querySelector('.cdk-overlay-container [role=menu]');
}

function topButtons(host: HTMLElement): HTMLButtonElement[] {
  return Array.from(
    host.querySelectorAll('[role=menubar] > [role=menuitem]')
  ) as HTMLButtonElement[];
}

function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  const host = f.nativeElement as HTMLElement;
  return { f, host };
}

describe('LgMenubar', () => {
  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove());
  });

  it('renders the #start, #end and a top-level #item per model entry', () => {
    const { host } = setup();
    expect(host.querySelector('.brand')?.textContent).toContain('LOGO');
    expect(host.querySelector('.user')?.textContent).toContain('USER');
    const labels = topButtons(host).map((b) => b.textContent?.trim());
    expect(labels).toEqual(['Edit', 'View', 'Help']);
  });

  it('passes root=true to top-level items', () => {
    const { host } = setup();
    expect(
      host.querySelector('[role=menubar] .row')?.getAttribute('data-root')
    ).toBe('true');
  });

  it('opens a submenu on click and toggles it closed', () => {
    const { f, host } = setup();
    const edit = topButtons(host)[0];
    edit.click();
    f.detectChanges();
    expect(openMenu()).not.toBeNull();
    expect(edit.getAttribute('aria-expanded')).toBe('true');
    // submenu items render via #item with root=false
    const rows = Array.from(container()!.querySelectorAll('.row')).map((r) =>
      r.textContent?.trim()
    );
    expect(rows).toEqual(['Undo', 'Redo']);

    edit.click();
    f.detectChanges();
    expect(openMenu()).toBeNull();
  });

  it('switches submenu on hover while another is open', () => {
    const { f, host } = setup();
    const [edit, view] = topButtons(host);
    edit.click();
    f.detectChanges();
    view.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    f.detectChanges();
    expect(view.getAttribute('aria-expanded')).toBe('true');
    expect(edit.getAttribute('aria-expanded')).toBe('false');
    const rows = Array.from(container()!.querySelectorAll('.row')).map((r) =>
      r.textContent?.trim()
    );
    expect(rows).toEqual(['Zoom In']);
  });

  it('does not open a submenu on hover when nothing is open', () => {
    const { f, host } = setup();
    topButtons(host)[0].dispatchEvent(
      new MouseEvent('mouseenter', { bubbles: true })
    );
    f.detectChanges();
    expect(openMenu()).toBeNull();
  });

  it('runs a submenu item command and closes', () => {
    const { f, host } = setup();
    topButtons(host)[0].click();
    f.detectChanges();
    const undo = container()!.querySelector(
      '[role=menuitem]'
    ) as HTMLButtonElement;
    undo.click();
    f.detectChanges();
    expect(f.componentInstance.undo).toHaveBeenCalledTimes(1);
    expect(openMenu()).toBeNull();
  });

  it('runs a leaf top-level item command directly (no submenu)', () => {
    const { f, host } = setup();
    topButtons(host)[2].click();
    f.detectChanges();
    expect(f.componentInstance.help).toHaveBeenCalledTimes(1);
    expect(openMenu()).toBeNull();
  });

  it('renders an item shortcut as kbd chips in the default row', () => {
    @Component({
      changeDetection: ChangeDetectionStrategy.OnPush,
      imports: [LgMenubar],
      template: `<lg-menubar [model]="items" />`
    })
    class PlainHostComponent {
      readonly items: MenuItem[] = [
        {
          label: 'Edit',
          items: [{ label: 'Undo', shortcut: { key: 'z', ctrl: true } }]
        }
      ];
    }
    const f = TestBed.createComponent(PlainHostComponent);
    f.detectChanges();
    topButtons(f.nativeElement as HTMLElement)[0].click();
    f.detectChanges();
    const chips = Array.from(container()!.querySelectorAll('kbd')).map((k) =>
      k.textContent?.trim()
    );
    expect(chips).toEqual(['Ctrl', 'Z']);
  });

  it('stays armed across a leaf hover: the next parent opens on hover again', () => {
    const { f, host } = setup();
    const [edit, view, help] = topButtons(host);
    edit.click();
    f.detectChanges();
    help.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    f.detectChanges();
    expect(openMenu()).toBeNull();
    view.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    f.detectChanges();
    expect(view.getAttribute('aria-expanded')).toBe('true');
    expect(openMenu()).not.toBeNull();
  });

  it('dismisses on a pointerdown on projected #end content (outside the item strip)', () => {
    const { f, host } = setup();
    topButtons(host)[0].click();
    f.detectChanges();
    expect(openMenu()).not.toBeNull();
    host
      .querySelector('.user')!
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    f.detectChanges();
    expect(openMenu()).toBeNull();
  });

  it('dismisses on an outside pointerdown (no backdrop intercepts the bar)', () => {
    const { f, host } = setup();
    topButtons(host)[0].click();
    f.detectChanges();
    expect(openMenu()).not.toBeNull();
    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true })
    );
    f.detectChanges();
    expect(openMenu()).toBeNull();
  });
});
