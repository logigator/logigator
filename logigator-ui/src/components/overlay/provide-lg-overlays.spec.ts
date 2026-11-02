import { afterEach, describe, expect, it } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ComponentPortal } from '@angular/cdk/portal';
import { LgOverlayService } from './overlay.service';
import { provideLgOverlays } from './provide-lg-overlays';

@Component({ template: `<span>PANEL BODY</span>` })
class PanelComponent {}

describe('provideLgOverlays', () => {
  afterEach(() => {
    document.querySelector('.cdk-overlay-container')?.remove();
  });

  it('opens overlays inside the overlay container, not as popovers', () => {
    TestBed.configureTestingModule({ providers: [provideLgOverlays()] });
    const ref = TestBed.inject(LgOverlayService).global({
      placement: 'center',
      hasBackdrop: true
    });
    ref.attach(new ComponentPortal(PanelComponent));

    expect(ref.hostElement.hasAttribute('popover')).toBe(false);
    expect(ref.hostElement.parentElement?.classList).toContain(
      'cdk-overlay-container'
    );

    ref.dispose();
  });
});
