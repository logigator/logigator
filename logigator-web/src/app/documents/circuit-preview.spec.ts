import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import type { CircuitPreview as PreviewSources } from '@logigator/contract';
import { configureTestBed } from '../../testing/configure-test-bed';
import { ThemingService } from '../theming/theming.service';
import { CircuitPreview } from './circuit-preview';

const PREVIEW: PreviewSources = {
  light: [{ url: '/p/light.webp', width: 256, height: 256, format: 'webp' }],
  dark: [{ url: '/p/dark.webp', width: 256, height: 256, format: 'webp' }]
};

function render(preview: PreviewSources | null): HTMLElement {
  const fixture = TestBed.createComponent(CircuitPreview);
  fixture.componentRef.setInput('preview', preview);
  fixture.detectChanges();
  return fixture.nativeElement;
}

describe('CircuitPreview', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    configureTestBed();
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
  });
});
