import { afterEach, describe, expect, it } from 'vitest';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgDrawer } from './drawer';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LgDrawer],
  template: `
    <lg-drawer
      [visible]="visible()"
      (visibleChange)="onVisibleChange($event)"
      position="bottom"
      header="Palette"
      styleClass="h-[90vh]!"
    >
      <div class="content">Drawer body</div>
    </lg-drawer>
  `
})
class HostComponent {
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

  it('merges the styleClass passthrough onto the panel', () => {
    const f = setup();
    f.componentInstance.visible.set(true);
    f.detectChanges();
    expect(panel()!.className).toContain('h-[90vh]!');
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
});
