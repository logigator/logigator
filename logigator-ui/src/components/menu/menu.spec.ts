import { afterEach, describe, expect, it, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgMenu } from './menu';
import { MenuItem } from './menu-item.model';

@Component({
  imports: [LgMenu],
  template: `
    <button (click)="menu.toggle($event)">trigger</button>
    <lg-menu
      #menu
      [model]="items()"
      (onShow)="open.set(true)"
      (onHide)="open.set(false)"
    >
      <ng-template #start><div class="start-block">START</div></ng-template>
      <ng-template #item let-item
        ><span class="row">{{ item.label }}</span></ng-template
      >
    </lg-menu>
  `
})
class HostComponent {
  readonly open = signal(false);
  readonly account = vi.fn();
  readonly profile = vi.fn();
  readonly items = signal<MenuItem[]>([
    { separator: true },
    { label: 'Account', icon: 'ph ph-user', command: () => this.account() },
    { label: 'Log Out', icon: 'ph ph-sign-out' }
  ]);
  readonly linkItems: MenuItem[] = [
    { label: 'Profile', href: '/profile', command: () => this.profile() },
    { label: 'Docs', href: '/docs' },
    { label: 'Gone', href: '/gone', disabled: true },
    { label: 'Log Out' }
  ];
}

/** The default row chrome, which a custom `#item` template replaces. */
@Component({
  imports: [LgMenu],
  template: `
    <button (click)="menu.toggle($event)">trigger</button>
    <lg-menu #menu [model]="items" />
  `
})
class DefaultChromeHost {
  readonly items: MenuItem[] = [
    { label: 'Help', href: 'https://example.com/help', target: '_blank' },
    { label: 'Delete', styleClass: 'text-error' }
  ];
}

function container(): Element | null {
  return document.querySelector('.cdk-overlay-container');
}

/**
 * Clicks `el` and reports whether the component cancelled the click. A
 * listener after it cancels whatever is left, so an unclaimed click on a link
 * does not navigate the test document.
 */
function clickClaimed(el: HTMLElement, init: MouseEventInit = {}): boolean {
  let claimed = false;
  const record = (event: Event) => {
    claimed = event.defaultPrevented;
    event.preventDefault();
  };
  document.addEventListener('click', record);
  el.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true, ...init })
  );
  document.removeEventListener('click', record);
  return claimed;
}

function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  const trigger = f.nativeElement.querySelector('button') as HTMLButtonElement;
  return { f, trigger };
}

describe('LgMenu', () => {
  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove());
  });

  it('toggles open and closed, firing onShow/onHide', () => {
    const { f, trigger } = setup();
    trigger.click();
    f.detectChanges();
    expect(f.componentInstance.open()).toBe(true);
    expect(container()?.querySelector('[role=menu]')).not.toBeNull();

    trigger.click();
    f.detectChanges();
    expect(f.componentInstance.open()).toBe(false);
  });

  it('renders the #start block and the #item slot per non-separator item', () => {
    const { f, trigger } = setup();
    trigger.click();
    f.detectChanges();
    expect(container()?.querySelector('.start-block')?.textContent).toContain(
      'START'
    );
    const rows = Array.from(container()!.querySelectorAll('.row')).map((r) =>
      r.textContent?.trim()
    );
    expect(rows).toEqual(['Account', 'Log Out']);
    // The separator does not render a menuitem button.
    expect(container()!.querySelectorAll('[role=menuitem]')).toHaveLength(2);
  });

  it('runs the item command and closes on select', () => {
    const { f, trigger } = setup();
    trigger.click();
    f.detectChanges();
    const accountItem = container()!.querySelector(
      '[role=menuitem]'
    ) as HTMLButtonElement;
    accountItem.click();
    f.detectChanges();
    expect(f.componentInstance.account).toHaveBeenCalledTimes(1);
    expect(f.componentInstance.open()).toBe(false);
  });

  it('closes on backdrop (outside) click', () => {
    const { f, trigger } = setup();
    trigger.click();
    f.detectChanges();
    const backdrop = document.querySelector(
      '.cdk-overlay-backdrop'
    ) as HTMLElement;
    backdrop.click();
    f.detectChanges();
    expect(f.componentInstance.open()).toBe(false);
  });

  it('ignores keys a nested control already handled (defaultPrevented)', () => {
    const { f, trigger } = setup();
    trigger.click();
    f.detectChanges();
    const panel = document.querySelector(
      '.cdk-overlay-container [role=menu]'
    ) as HTMLElement;
    // A capturing listener stands in for the nested control consuming the key.
    const consume = (e: Event) => e.preventDefault();
    document.addEventListener('keydown', consume, true);
    panel.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true
      })
    );
    document.removeEventListener('keydown', consume, true);
    f.detectChanges();
    // Escape was pre-handled, so the menu must NOT close.
    expect(f.componentInstance.open()).toBe(true);
  });

  it('reports closed when cdk disposes the panel on navigation', () => {
    const { f, trigger } = setup();
    trigger.click();
    f.detectChanges();
    expect(f.componentInstance.open()).toBe(true);

    // `disposeOnNavigation` disposes the overlay behind the menu's back.
    window.dispatchEvent(new PopStateEvent('popstate'));
    f.detectChanges();
    expect(f.componentInstance.open()).toBe(false);
    expect(container()?.querySelector('[role=menu]')).toBeNull();

    // The ref went with it, so the trigger opens rather than toggling shut.
    trigger.click();
    f.detectChanges();
    expect(container()?.querySelector('[role=menu]')).not.toBeNull();
  });

  it('renders an item with an href as a link, and one without as a button', () => {
    const { f, trigger } = setup();
    f.componentInstance.items.set(f.componentInstance.linkItems);
    trigger.click();
    f.detectChanges();
    const rows = Array.from(
      container()!.querySelectorAll<HTMLElement>('[role=menuitem]')
    ).map((row) => [row.tagName, row.getAttribute('href')]);
    // A disabled link names no destination: nothing may open it in a tab.
    expect(rows).toEqual([
      ['A', '/profile'],
      ['A', '/docs'],
      ['A', null],
      ['BUTTON', null]
    ]);
  });

  it('runs a link item on a plain click in place of the navigation', () => {
    const { f, trigger } = setup();
    f.componentInstance.items.set(f.componentInstance.linkItems);
    trigger.click();
    f.detectChanges();
    const profile =
      container()!.querySelector<HTMLElement>('a[role=menuitem]')!;
    expect(clickClaimed(profile)).toBe(true);
    f.detectChanges();
    expect(f.componentInstance.profile).toHaveBeenCalledTimes(1);
    expect(f.componentInstance.open()).toBe(false);
  });

  it.each(['ctrlKey', 'metaKey', 'shiftKey'] as const)(
    'leaves a %s click on a link item to the browser, and closes',
    (modifier) => {
      const { f, trigger } = setup();
      f.componentInstance.items.set(f.componentInstance.linkItems);
      trigger.click();
      f.detectChanges();
      const profile =
        container()!.querySelector<HTMLElement>('a[role=menuitem]')!;
      expect(clickClaimed(profile, { [modifier]: true })).toBe(false);
      f.detectChanges();
      expect(f.componentInstance.profile).not.toHaveBeenCalled();
      expect(f.componentInstance.open()).toBe(false);
    }
  );

  it('follows a link item with no command to run', () => {
    const { f, trigger } = setup();
    f.componentInstance.items.set(f.componentInstance.linkItems);
    trigger.click();
    f.detectChanges();
    const docs =
      container()!.querySelectorAll<HTMLElement>('a[role=menuitem]')[1];
    expect(clickClaimed(docs)).toBe(false);
  });

  it('roves over enabled link items but skips a disabled one', async () => {
    const { f, trigger } = setup();
    f.componentInstance.items.set(f.componentInstance.linkItems);
    trigger.click();
    f.detectChanges();
    // Opening focuses the first item a microtask later.
    await Promise.resolve();
    const panel = container()!.querySelector<HTMLElement>('[role=menu]')!;
    const labels: (string | undefined)[] = [];
    for (let i = 0; i < 3; i++) {
      panel.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
          cancelable: true
        })
      );
      labels.push(document.activeElement?.textContent?.trim());
    }
    expect(labels).toEqual(['Docs', 'Log Out', 'Profile']);
  });

  it('opens a link item where its target says, and styles the row content with styleClass', () => {
    const f = TestBed.createComponent(DefaultChromeHost);
    f.detectChanges();
    (f.nativeElement.querySelector('button') as HTMLButtonElement).click();
    f.detectChanges();
    const [help, del] = Array.from(
      container()!.querySelectorAll<HTMLElement>('[role=menuitem]')
    );
    expect(help.getAttribute('target')).toBe('_blank');
    expect(del.hasAttribute('target')).toBe(false);
    // On the content, not the row: the row's own text colour would otherwise
    // compete with it on stylesheet order.
    expect(del.classList.contains('text-error')).toBe(false);
    expect(del.firstElementChild?.classList.contains('text-error')).toBe(true);
    expect(del.textContent?.trim()).toBe('Delete');
  });
});
