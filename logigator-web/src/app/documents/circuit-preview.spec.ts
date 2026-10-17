import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import type { CircuitPreview as PreviewSources } from '@logigator/contract';
import { configureTestBed } from '../../testing/configure-test-bed';
import { ThemingService } from '../theming/theming.service';
import { CircuitPreview } from './circuit-preview';

const PREVIEW: PreviewSources = {
  light: [{ url: '/p/light.webp', width: 256, height: 256, format: 'webp' }],
  dark: [{ url: '/p/dark.webp', width: 256, height: 256, format: 'webp' }]
};

const LADDER: PreviewSources = {
  light: [
    { url: '/p/light-256.webp', width: 256, height: 256, format: 'webp' },
    { url: '/p/light-1024.webp', width: 1024, height: 1024, format: 'webp' }
  ],
  dark: [
    { url: '/p/dark-256.webp', width: 256, height: 256, format: 'webp' },
    { url: '/p/dark-1024.webp', width: 1024, height: 1024, format: 'webp' }
  ]
};

function setup(preview: PreviewSources | null) {
  const fixture = TestBed.createComponent(CircuitPreview);
  fixture.componentRef.setInput('preview', preview);
  fixture.componentRef.setInput('name', 'Adder');
  fixture.detectChanges();
  return fixture;
}

function render(preview: PreviewSources | null): HTMLElement {
  return setup(preview).nativeElement;
}

describe('CircuitPreview', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    configureTestBed();
  });

  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove());
  });

  it('draws the render for the scheme the page is in', () => {
    // Both themes are separate renders and no <picture> can negotiate a colour
    // scheme, so the choice is made here rather than by the markup.
    TestBed.inject(ThemingService).setTheme('dark');
    expect(render(PREVIEW).querySelector('img')!.getAttribute('src')).toBe(
      '/p/dark.webp'
    );

    TestBed.inject(ThemingService).setTheme('light');
    expect(render(PREVIEW).querySelector('img')!.getAttribute('src')).toBe(
      '/p/light.webp'
    );
  });

  it('says so where the circuit has no render at all', () => {
    // A circuit never saved from the editor: the frame would otherwise be a
    // blank square, indistinguishable from a board with nothing on it.
    const el = render(null);

    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('lg-preview-placeholder')).not.toBeNull();
    // Nothing to enlarge, so no control offering to.
    expect(el.querySelector('button')).toBeNull();
  });

  it('opens the whole ladder of the active theme on the dot ground when clicked', () => {
    // The frame drew a narrow rung; the enlarged board must be free to fetch
    // the widest, and the render is transparent line art the dark backdrop
    // would otherwise swallow.
    TestBed.inject(ThemingService).setTheme('dark');
    const fixture = setup(LADDER);
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    const enlarged = document.querySelector<HTMLImageElement>(
      '.cdk-overlay-container img'
    )!;
    expect(enlarged.getAttribute('srcset')).toContain('/p/dark-1024.webp');
    expect(enlarged.alt).toBe('Adder');
    expect(enlarged.classList.contains('lattice')).toBe(true);
  });
});
