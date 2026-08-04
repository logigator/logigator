import { afterEach, describe, expect, it } from 'vitest';
import { Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgDrawer } from './drawer';

@Component({
  imports: [LgDrawer],
  template: `
    <lg-drawer
      [visible]="visible()"
      (visibleChange)="onVisibleChange($event)"
      position="bottom"
      header="Palette"
      styleClass="h-[90vh]!"
      [modal]="modal()"
    >
      <div class="content">Drawer body</div>
    </lg-drawer>
  `
})
class HostComponent {
  readonly modal = input(true);
  readonly visible = signal(false);
  readonly changes: boolean[] = [];

  onVisibleChange(value: boolean): void {
    this.changes.push(value);
    this.visible.set(value);
  }
}

function container(): Element | null {
  return document.querySelector('.cdk-overlay-container');
}

function panel(): HTMLElement | null {
  return document.querySelector('.cdk-overlay-container [role=dialog]');
}

function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  return f;
}

describe('LgDrawer', () => {
  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove());
  });

  it('renders nothing while visible is false', () => {
    setup();
    expect(panel()).toBeNull();
  });

  it('renders the header and projected content when visible', () => {
    const f = setup();
    f.componentInstance.visible.set(true);
    f.detectChanges();
    expect(panel()).not.toBeNull();
    expect(container()?.querySelector('h2')?.textContent).toContain('Palette');
    expect(container()?.querySelector('.content')?.textContent).toContain(
      'Drawer body'
    );
  });

  it('closes on backdrop click (a drawer is always dismissable)', () => {
    const f = setup();
    f.componentInstance.visible.set(true);
    f.detectChanges();
    (document.querySelector('.cdk-overlay-backdrop') as HTMLElement).click();
    f.detectChanges();
    expect(f.componentInstance.changes).toContain(false);
    expect(panel()).toBeNull();
  });

  it('emits visibleChange(false) on Escape', () => {
    const f = setup();
    f.componentInstance.visible.set(true);
    f.detectChanges();
    panel()!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    f.detectChanges();
    expect(f.componentInstance.changes).toContain(false);
  });

  it('emits visibleChange(false) when the close button is clicked', () => {
    const f = setup();
    f.componentInstance.visible.set(true);
    f.detectChanges();
    const close = container()?.querySelector(
      '[aria-label=Close]'
    ) as HTMLButtonElement;
    close.click();
    f.detectChanges();
    expect(f.componentInstance.changes).toContain(false);
  });

  it('non-modal: no backdrop, no focus trap, no aria-modal', () => {
    const previouslyFocused = document.activeElement;
    const f = setup();
    f.componentRef.setInput('modal', false);
    f.componentInstance.visible.set(true);
    f.detectChanges();

    expect(panel()).not.toBeNull();
    expect(document.querySelector('.cdk-overlay-backdrop')).toBeNull();
    expect(panel()!.getAttribute('aria-modal')).toBeNull();
    // Focus was not pulled into the drawer.
    expect(document.activeElement).toBe(previouslyFocused);
  });
});
