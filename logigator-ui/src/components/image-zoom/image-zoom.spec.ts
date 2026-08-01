import { afterEach, describe, expect, it } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgImageZoom } from './image-zoom';

@Component({
  imports: [LgImageZoom],
  template: `
    <div lgImageZoom>
      <p>Prose around the screenshots.</p>
      <img class="first" src="first.png" alt="First shot" />
      <img class="second" src="second.png" alt="Second shot" />
    </div>
  `
})
class ContainerHost {}

@Component({
  imports: [LgImageZoom],
  template: `<img lgImageZoom src="only.png" alt="Only shot" />`
})
class SingleImageHost {}

function enlarged(): HTMLImageElement | null {
  return document.querySelector('.cdk-overlay-container img');
}

describe('LgImageZoom', () => {
  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove());
  });

  it('opens the clicked image, not another image under the same host', () => {
    const f = TestBed.createComponent(ContainerHost);
    f.detectChanges();

    f.nativeElement.querySelector('.second').click();
    f.detectChanges();

    expect(enlarged()?.getAttribute('src')).toContain('second.png');
    expect(enlarged()?.alt).toBe('Second shot');
  });

  it('ignores clicks that did not land on an image', () => {
    const f = TestBed.createComponent(ContainerHost);
    f.detectChanges();

    f.nativeElement.querySelector('p').click();
    f.detectChanges();

    expect(enlarged()).toBeNull();
  });

  it('opens the host itself when applied directly to an image', () => {
    const f = TestBed.createComponent(SingleImageHost);
    f.detectChanges();

    f.nativeElement.querySelector('img').click();
    f.detectChanges();

    expect(enlarged()?.getAttribute('src')).toContain('only.png');
  });

  it('makes covered images keyboard-reachable and opens them on Enter', () => {
    const f = TestBed.createComponent(ContainerHost);
    f.detectChanges();

    const image = f.nativeElement.querySelector('.first') as HTMLImageElement;
    expect(image.tabIndex).toBe(0);

    image.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    f.detectChanges();

    expect(enlarged()?.getAttribute('src')).toContain('first.png');
  });

  it('closes when the enlarged image is clicked', () => {
    const f = TestBed.createComponent(ContainerHost);
    f.detectChanges();
    f.nativeElement.querySelector('.first').click();
    f.detectChanges();

    (
      document.querySelector(
        '.cdk-overlay-container [aria-label=Close]'
      ) as HTMLButtonElement
    ).click();
    f.detectChanges();

    expect(enlarged()).toBeNull();
  });

  it('covers images that appear after the directive was created', async () => {
    const f = TestBed.createComponent(ContainerHost);
    f.detectChanges();

    const added = document.createElement('img');
    added.src = 'late.png';
    added.className = 'late';
    f.nativeElement.querySelector('[lgImageZoom]').append(added);
    // MutationObserver callbacks run as a microtask.
    await Promise.resolve();

    expect(added.tabIndex).toBe(0);
    added.click();
    f.detectChanges();

    expect(enlarged()?.getAttribute('src')).toContain('late.png');
  });
});
