import { describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LgButton } from './button';
import { LgSeverity } from '../../tokens/severity';
import { LgSize } from '../../tokens/size';

@Component({
  imports: [LgButton],
  template: `<button
    lgButton
    class="md:hidden shrink-0"
    [icon]="icon()"
    [severity]="severity()"
    [type]="type()"
    [disabled]="disabled()"
    [loading]="loading()"
    [disabledInteractive]="disabledInteractive()"
    (onClick)="clicks.set(clicks() + 1)"
  >
    Save
  </button>`
})
class ButtonHost {
  readonly icon = signal<string | undefined>(undefined);
  readonly severity = signal<LgSeverity | undefined>(undefined);
  readonly type = signal<'button' | 'submit' | 'reset'>('button');
  readonly disabled = signal(false);
  readonly loading = signal(false);
  readonly disabledInteractive = signal(false);
  readonly clicks = signal(0);
}

// One icon-only and one labelled button, otherwise identical, so a spec can
// compare the boxes the size map hands them.
@Component({
  imports: [LgButton],
  template: `<button
      lgButton
      #glyph
      [size]="size()"
      icon="ph ph-trash"
    ></button>
    <button lgButton #labelled [size]="size()" icon="ph ph-trash">Save</button>`
})
class SizingHost {
  readonly size = signal<LgSize | undefined>(undefined);
}

@Component({
  imports: [LgButton],
  template: `<a
    lgButton
    [disabled]="disabled()"
    (onClick)="clicks.set(clicks() + 1)"
    >Log in</a
  >`
})
class AnchorHost {
  readonly disabled = signal(false);
  readonly clicks = signal(0);
}

function buttonHost(): {
  f: ComponentFixture<ButtonHost>;
  host: ButtonHost;
  el: HTMLButtonElement;
} {
  const f = TestBed.createComponent(ButtonHost);
  f.detectChanges();
  return {
    f,
    host: f.componentInstance,
    el: f.nativeElement.querySelector('button') as HTMLButtonElement
  };
}

function anchorHost(): {
  f: ComponentFixture<AnchorHost>;
  host: AnchorHost;
  el: HTMLAnchorElement;
} {
  const f = TestBed.createComponent(AnchorHost);
  f.detectChanges();
  return {
    f,
    host: f.componentInstance,
    el: f.nativeElement.querySelector('a') as HTMLAnchorElement
  };
}

/** The text runs a flex container would lay out as their own items. */
function textItems(el: Element): string[] {
  return Array.from(el.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
    .map((n) => n.textContent?.trim() ?? '');
}

describe('LgButton', () => {
  it('sizes an icon-only and a labelled button identically at every step', () => {
    // The box is a floor plus padding applied unconditionally, so the two line
    // up in a row; a branch on whether content was projected would break that.
    const f = TestBed.createComponent(SizingHost);
    f.detectChanges();
    const [glyph, labelled] = Array.from(
      f.nativeElement.querySelectorAll('button')
    ) as HTMLButtonElement[];

    const boxes = new Set<string>();
    for (const size of ['sm', 'md', 'lg', 'xl'] as const) {
      f.componentInstance.size.set(size);
      f.detectChanges();
      expect(glyph.className).toBe(labelled.className);
      boxes.add(glyph.className);
    }
    // Each step is its own box rather than one shared string.
    expect(boxes.size).toBe(4);
  });

  it('projects the label as a bare child, with no wrapper element', () => {
    // A wrapper would be a second flex item, and `gap-2` would widen the box
    // past the square the floor produces.
    const { el } = buttonHost();
    expect(el.querySelector('span')).toBeNull();
    expect(textItems(el)).toEqual(['Save']);
    expect(el.children).toHaveLength(0);
  });

  it('renders the icon beside the label as the only element child', () => {
    const { f, host, el } = buttonHost();
    host.icon.set('ph ph-trash');
    f.detectChanges();
    expect(Array.from(el.children).map((c) => c.tagName)).toEqual(['I']);
    expect(el.querySelector('i')?.className).toContain('ph-trash');
    expect(textItems(el)).toEqual(['Save']);
  });

  it('keeps a consumer class beside the variant classes across a recompute', () => {
    const { f, host, el } = buttonHost();
    expect(el.classList.contains('md:hidden')).toBe(true);
    expect(el.classList.contains('shrink-0')).toBe(true);
    expect(el.classList.contains('rounded-md')).toBe(true);
    expect(el.classList.contains('bg-primary')).toBe(true);

    host.severity.set('danger');
    f.detectChanges();

    expect(el.classList.contains('md:hidden')).toBe(true);
    expect(el.classList.contains('shrink-0')).toBe(true);
    expect(el.classList.contains('bg-error')).toBe(true);
    expect(el.classList.contains('bg-primary')).toBe(false);
  });

  it('emits onClick and reflects the type on a button host', () => {
    const { f, host, el } = buttonHost();
    expect(el.getAttribute('type')).toBe('button');
    host.type.set('submit');
    f.detectChanges();
    expect(el.getAttribute('type')).toBe('submit');
    el.click();
    expect(host.clicks()).toBe(1);
  });

  it('disables a button natively and stops emitting', () => {
    const { f, host, el } = buttonHost();
    host.disabled.set(true);
    f.detectChanges();
    expect(el.disabled).toBe(true);
    expect(el.getAttribute('aria-disabled')).toBeNull();
    el.click();
    expect(host.clicks()).toBe(0);
  });

  it('swaps the icon for a spinner and force-disables while loading', () => {
    const { f, host, el } = buttonHost();
    host.icon.set('ph ph-trash');
    host.loading.set(true);
    f.detectChanges();
    expect(el.disabled).toBe(true);
    expect(el.querySelector('i')).toBeNull();
    expect(el.querySelector('.animate-spin')).not.toBeNull();
  });

  it('leaves a disabledInteractive button hoverable: no native attribute, no hover styling', () => {
    const { f, host, el } = buttonHost();
    host.disabled.set(true);
    host.disabledInteractive.set(true);
    f.detectChanges();

    // `disabled:pointer-events-none` hangs off `:disabled`, so the absent
    // attribute is what keeps a tooltip on the host firing.
    expect(el.hasAttribute('disabled')).toBe(false);
    expect(el.disabled).toBe(false);
    expect(el.getAttribute('aria-disabled')).toBe('true');
    expect(el.className).not.toMatch(/hover:|active:/);

    el.click();
    expect(host.clicks()).toBe(0);
  });

  it('suppresses a disabled anchor without a native attribute', () => {
    const { f, host, el } = anchorHost();
    expect(el.hasAttribute('type')).toBe(false);

    const enabled = new MouseEvent('click', {
      bubbles: true,
      cancelable: true
    });
    el.dispatchEvent(enabled);
    expect(enabled.defaultPrevented).toBe(false);
    expect(host.clicks()).toBe(1);

    host.disabled.set(true);
    f.detectChanges();
    expect(el.hasAttribute('disabled')).toBe(false);
    expect(el.getAttribute('aria-disabled')).toBe('true');

    const suppressed = new MouseEvent('click', {
      bubbles: true,
      cancelable: true
    });
    el.dispatchEvent(suppressed);
    expect(suppressed.defaultPrevented).toBe(true);
    expect(host.clicks()).toBe(1);
  });
});
