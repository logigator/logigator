import { afterEach, describe, expect, it } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ComponentPortal } from '@angular/cdk/portal';
import { connectedPositions } from '../../internal/overlay';
import { LgOverlayService } from './overlay.service';

@Component({ template: `<span>PANEL BODY</span>` })
class PanelComponent {}

function container(): Element | null {
  return document.querySelector('.cdk-overlay-container');
}

describe('LgOverlayService', () => {
  afterEach(() => {
    container()?.remove();
  });

  it('attaches a portal into a connected overlay and disposes it cleanly', () => {
    const service = TestBed.inject(LgOverlayService);
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);

    const ref = service.connected({
      origin: anchor,
      positions: connectedPositions('bottom')
    });
    ref.attach(new ComponentPortal(PanelComponent));

    expect(container()?.textContent).toContain('PANEL BODY');

    ref.dispose();
    expect(container()?.textContent ?? '').not.toContain('PANEL BODY');
    anchor.remove();
  });

  it('builds a global overlay with a backdrop when asked', () => {
    const service = TestBed.inject(LgOverlayService);

    const ref = service.global({ placement: 'center', hasBackdrop: true });
    ref.attach(new ComponentPortal(PanelComponent));

    expect(document.querySelector('.cdk-overlay-backdrop')).not.toBeNull();

    ref.dispose();
  });
});
