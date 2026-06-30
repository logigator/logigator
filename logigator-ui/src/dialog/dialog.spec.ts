import { afterEach, describe, expect, it } from 'vitest';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgDialog } from './dialog';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LgDialog],
  template: `
    <lg-dialog
      [visible]="visible()"
      (visibleChange)="onVisibleChange($event)"
      header="My Dialog"
      [modal]="true"
      [dismissableMask]="dismissable()"
      [style]="{ width: '40rem' }"
    >
      <p class="body">Body content</p>
      <ng-template #footer>
        <button class="foot">Footer button</button>
      </ng-template>
    </lg-dialog>
  `
})
class HostComponent {
  readonly visible = signal(false);
  readonly dismissable = signal(false);
  readonly changes: boolean[] = [];

  onVisibleChange(value: boolean): void {
    this.changes.push(value);
    // Mirror the one-way contract: the parent re-derives `visible`.
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

describe('LgDialog', () => {
  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove());
  });

  it('renders nothing while visible is false', () => {
    setup();
    expect(panel()).toBeNull();
  });

  it('renders the header, projected body and #footer slot when visible', () => {
    const f = setup();
    f.componentInstance.visible.set(true);
    f.detectChanges();
    expect(panel()).not.toBeNull();
    expect(container()?.querySelector('h2')?.textContent).toContain(
      'My Dialog'
    );
    expect(container()?.querySelector('.body')?.textContent).toContain(
      'Body content'
    );
    expect(container()?.querySelector('.foot')?.textContent).toContain(
      'Footer button'
    );
  });

  it('emits visibleChange(false) and closes when the close button is clicked', () => {
    const f = setup();
    f.componentInstance.visible.set(true);
    f.detectChanges();
    const close = container()?.querySelector(
      '[aria-label=Close]'
    ) as HTMLButtonElement;
    close.click();
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

  it('ignores backdrop clicks when dismissableMask is false', () => {
    const f = setup();
    f.componentInstance.visible.set(true);
    f.detectChanges();
    (document.querySelector('.cdk-overlay-backdrop') as HTMLElement).click();
    f.detectChanges();
    expect(f.componentInstance.changes).toEqual([]);
    expect(panel()).not.toBeNull();
  });

  it('closes on backdrop click when dismissableMask is true', () => {
    const f = setup();
    f.componentInstance.dismissable.set(true);
    f.componentInstance.visible.set(true);
    f.detectChanges();
    (document.querySelector('.cdk-overlay-backdrop') as HTMLElement).click();
    f.detectChanges();
    expect(f.componentInstance.changes).toContain(false);
  });
});
