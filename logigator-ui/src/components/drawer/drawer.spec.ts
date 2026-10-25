import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InteractivityChecker } from '@angular/cdk/a11y';
import { Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgHelpAction } from '../../tokens/help-action';
import { LgDrawer } from './drawer';

@Component({
  imports: [LgDrawer],
  template: `
    <lg-drawer
      [visible]="visible()"
      (visibleChange)="onVisibleChange($event)"
      [position]="position()"
      header="Palette"
      styleClass="h-[90vh]!"
      [modal]="modal()"
      [help]="help()"
    >
      <div class="content">Drawer body</div>
    </lg-drawer>
  `
})
class HostComponent {
  readonly modal = input(true);
  readonly position = input<'bottom' | 'left'>('bottom');
  readonly visible = signal(false);
  readonly help = signal<LgHelpAction | null>(null);
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

  it('draws a help button only when given one, and runs it without closing', () => {
    const f = setup();
    f.componentInstance.visible.set(true);
    f.detectChanges();
    expect(container()?.querySelector('[aria-label=Help]')).toBeNull();

    let helped = 0;
    f.componentInstance.help.set({ label: 'Help', command: () => helped++ });
    f.detectChanges();
    (
      container()?.querySelector('[aria-label=Help]') as HTMLButtonElement
    ).click();
    f.detectChanges();
    expect(helped).toBe(1);
    expect(f.componentInstance.changes).toEqual([]);
    expect(panel()).not.toBeNull();
  });

  it('opens with focus on the close button, past the help button', () => {
    // jsdom lays nothing out, and the checker counts an element without
    // geometry as hidden, so nothing would be focusable.
    class LaidOutChecker extends InteractivityChecker {
      override isVisible(): boolean {
        return true;
      }
    }
    TestBed.configureTestingModule({
      providers: [{ provide: InteractivityChecker, useClass: LaidOutChecker }]
    });
    const f = setup();
    f.componentInstance.help.set({ label: 'Help', command: () => undefined });
    f.componentInstance.visible.set(true);
    f.detectChanges();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close');
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

  it('asks its host to close when cdk disposes the panel on navigation', () => {
    const f = setup();
    f.componentInstance.visible.set(true);
    f.detectChanges();
    expect(panel()).not.toBeNull();

    // `disposeOnNavigation` disposes the overlay behind the drawer's back; the
    // host has to hear about it, or `visible` sticks true and the trigger that
    // sets it can never reopen the drawer.
    window.dispatchEvent(new PopStateEvent('popstate'));
    f.detectChanges();
    expect(panel()).toBeNull();
    expect(f.componentInstance.changes.at(-1)).toBe(false);

    f.componentInstance.visible.set(true);
    f.detectChanges();
    expect(panel()).not.toBeNull();
  });

  describe('over an on-screen keyboard', () => {
    let viewport: EventTarget & {
      height: number;
      offsetTop: number;
      scale: number;
    };

    beforeEach(() => {
      viewport = Object.assign(new EventTarget(), {
        height: 800,
        offsetTop: 0,
        scale: 1
      });
      Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        value: viewport
      });
    });

    afterEach(() => {
      delete (window as { visualViewport?: unknown }).visualViewport;
    });

    /** Opens the drawer in a layout viewport 800px tall. */
    function open(position: 'bottom' | 'left') {
      const f = setup();
      f.componentRef.setInput('modal', false);
      f.componentRef.setInput('position', position);
      f.componentInstance.visible.set(true);
      f.detectChanges();
      Object.defineProperty(container(), 'clientHeight', { value: 800 });
      return f;
    }

    function resize(height: number, offsetTop = 0): void {
      viewport.height = height;
      viewport.offsetTop = offsetTop;
      viewport.dispatchEvent(new Event('resize'));
    }

    it('lifts a bottom sheet above the keyboard and caps it to what stays visible', () => {
      const f = open('bottom');
      resize(480);
      f.detectChanges();
      expect(panel()!.style.marginBottom).toBe('320px');
      expect(panel()!.style.maxHeight).toBe('calc(480px - 2.5rem)');

      resize(800);
      f.detectChanges();
      expect(panel()!.style.marginBottom).toBe('');
      expect(panel()!.style.maxHeight).toBe('');
    });

    it('measures the viewport afresh each time it opens', () => {
      const f = open('bottom');
      resize(480);
      f.componentInstance.visible.set(false);
      f.detectChanges();
      resize(800);
      f.componentInstance.visible.set(true);
      f.detectChanges();
      expect(panel()!.style.marginBottom).toBe('');

      resize(480);
      f.detectChanges();
      expect(panel()!.style.marginBottom).toBe('320px');
    });

    it('leaves a side drawer where it is', () => {
      const f = open('left');
      resize(480);
      f.detectChanges();
      expect(panel()!.style.marginBottom).toBe('');
      expect(panel()!.style.maxHeight).toBe('');
    });
  });
});
