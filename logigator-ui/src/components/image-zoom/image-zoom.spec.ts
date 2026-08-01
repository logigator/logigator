import { afterEach, describe, expect, it } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgImageZoom } from './image-zoom';

@Component({
  imports: [LgImageZoom],
  template: `<lg-image-zoom src="shot.png" alt="Only shot" />`
})
class Host {}

function enlarged(): HTMLImageElement | null {
  return document.querySelector('.cdk-overlay-container img');
}

describe('LgImageZoom', () => {
  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove());
  });

  function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture;
  }

  it('opens its image full-size when activated', () => {
    const fixture = setup();

    (
      fixture.nativeElement.querySelector('button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(enlarged()?.getAttribute('src')).toContain('shot.png');
    expect(enlarged()?.alt).toBe('Only shot');
  });

  it('closes when the enlarged image is clicked', () => {
    const fixture = setup();
    (
      fixture.nativeElement.querySelector('button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    (
      document.querySelector(
        '.cdk-overlay-container [aria-label=Close]'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(enlarged()).toBeNull();
  });

  it('closes an open overlay when the component is destroyed', () => {
    const fixture = setup();
    (
      fixture.nativeElement.querySelector('button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(enlarged()).not.toBeNull();

    fixture.destroy();

    expect(enlarged()).toBeNull();
  });
});
