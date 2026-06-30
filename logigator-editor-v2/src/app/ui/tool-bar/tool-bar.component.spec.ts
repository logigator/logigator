import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ToolBarComponent } from './tool-bar.component';
import { DialogService } from '@logigator/ui';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { WorkModeService } from '../../work-mode/work-mode.service';

describe('ToolBarComponent', () => {
  let component: ToolBarComponent;
  let fixture: ComponentFixture<ToolBarComponent>;

  beforeEach(() => {
    configureTestBed(
      [{ provide: DialogService, useValue: { open: () => null } }],
      [ToolBarComponent]
    );

    fixture = TestBed.createComponent(ToolBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // The *transloco directive renders its template only after the language
  // file's dynamic import resolves — poll until the DOM appears.
  async function waitForRender(): Promise<HTMLElement> {
    const el: HTMLElement = fixture.nativeElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.querySelector('lg-button')).not.toBeNull();
    });
    return el;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the editing tools (including start-simulation) outside simulation mode', async () => {
    const el = await waitForRender();
    expect(el.querySelector('.ph-play')).not.toBeNull(); // start simulation
    expect(el.querySelector('.ph-line-segment')).not.toBeNull(); // wire tool
    expect(el.querySelector('.ph-sign-out')).toBeNull(); // no exit button
  });

  it('swaps to the simulation control set in simulation mode', async () => {
    TestBed.inject(WorkModeService).setSimulationMode(true);
    const el = await waitForRender();
    expect(el.querySelector('.ph-sign-out')).not.toBeNull(); // exit
    expect(el.querySelector('.ph-pause')).not.toBeNull();
    expect(el.querySelector('.ph-skip-forward')).not.toBeNull(); // step
    expect(el.querySelector('.ph-stop')).not.toBeNull();
    expect(el.querySelector('.ph-line-segment')).toBeNull(); // tools hidden
    expect(el.querySelector('.ph-trash')).toBeNull(); // delete hidden

    // Run controls stay disabled until the worker session reports ready —
    // here no session was started, so they render inert.
    const playButton = el
      .querySelector('.ph-play')
      ?.closest('button') as HTMLButtonElement;
    expect(playButton.disabled).toBe(true);
  });
});
