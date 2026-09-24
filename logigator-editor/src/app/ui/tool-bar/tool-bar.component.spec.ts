import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ToolBarComponent } from './tool-bar.component';
import { DialogService } from '@logigator/ui';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { WorkMode } from '../../work-mode/work-mode.enum';
import { BuiltInComponentType } from '@logigator/core';

describe('ToolBarComponent', () => {
  let fixture: ComponentFixture<ToolBarComponent>;

  beforeEach(() => {
    configureTestBed(
      [{ provide: DialogService, useValue: { open: () => null } }],
      [ToolBarComponent]
    );

    fixture = TestBed.createComponent(ToolBarComponent);
    fixture.detectChanges();
  });

  // Work mode and shortcut bindings settle asynchronously, so poll until the
  // buttons appear.
  async function waitForRender(): Promise<HTMLElement> {
    const el: HTMLElement = fixture.nativeElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.querySelector('button[lgButton]')).not.toBeNull();
    });
    return el;
  }

  it('shows the editing tools (including start-simulation) outside simulation mode', async () => {
    const el = await waitForRender();
    expect(el.querySelector('.ph-play')).not.toBeNull(); // start simulation
    expect(el.querySelector('.ph-line-segment')).not.toBeNull(); // wire tool
    expect(el.querySelector('.ph-sign-out')).toBeNull(); // no exit button
  });

  const rotateButton = (el: HTMLElement): HTMLButtonElement =>
    el.querySelector('.ph-arrow-clockwise')!.closest('button')!;

  // `disabledInteractive` keeps these buttons hoverable, so the off state is
  // `aria-disabled` rather than a native attribute.
  const isDisabled = (el: HTMLElement): boolean =>
    rotateButton(el).getAttribute('aria-disabled') === 'true';

  it('enables the rotate buttons only while a rotate has a target', async () => {
    const el = await waitForRender();
    expect(isDisabled(el)).toBe(true);

    // An armed placement turns the pending component, though nothing is
    // selected yet.
    const workMode = TestBed.inject(WorkModeService);
    workMode.setMode(WorkMode.COMPONENT_PLACEMENT);
    workMode.setSelectedComponentType(BuiltInComponentType.AND);
    await waitForRender();

    expect(isDisabled(el)).toBe(false);

    // Leaving placement drops the target again.
    workMode.setMode(WorkMode.SELECT);
    await waitForRender();

    expect(isDisabled(el)).toBe(true);
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

    // Run controls stay inert until a worker session reports ready; none was
    // started. They carry `disabledInteractive`, so the element stays
    // hoverable and its tooltip keeps explaining why the button is off.
    const playButton = el
      .querySelector('.ph-play')
      ?.closest('button') as HTMLButtonElement;
    expect(playButton.getAttribute('aria-disabled')).toBe('true');
    expect(playButton.hasAttribute('disabled')).toBe(false);
  });
});
