import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isSignal, signal, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgHelpAction, WindowService } from '@logigator/ui';
import { configureTestBed } from '../../testing/configure-test-bed';
import { Component } from '../components/component';
import { ComponentInspection } from '../components/component-inspection';
import { DocsTarget } from '../documentation/docs-target';
import { DocumentationService } from '../documentation/documentation.service';
import { OpenInspection } from './inspection-presenter';
import { WindowInspectionPresenter } from './window-inspection.presenter';

class TestInspection extends ComponentInspection {
  readonly kind = 'rom';
  readonly renderer = class {} as Type<unknown>;
  readonly title = signal('ROM');
  override readonly sizing = {
    initial: { width: 600, height: 500 },
    min: { width: 300, height: 200 }
  };
}

class DocumentedInspection extends TestInspection {
  override readonly docs = signal<DocsTarget>({
    page: 'inspection',
    anchor: 'rom-contents'
  });
}

function makeEntry(): OpenInspection {
  return {
    component: {} as Component,
    inspection: new TestInspection()
  };
}

describe('WindowInspectionPresenter', () => {
  let presenter: WindowInspectionPresenter;
  let windowService: WindowService;

  beforeEach(() => {
    configureTestBed();
    presenter = TestBed.inject(WindowInspectionPresenter);
    windowService = TestBed.inject(WindowService);
  });

  it('opens a window carrying the inspection as renderer input and sizing', () => {
    const entry = makeEntry();
    presenter.show(entry, () => undefined);

    const windows = windowService.windows();
    expect(windows).toHaveLength(1);
    expect(windows[0].component).toBe(entry.inspection.renderer);
    expect(windows[0].config.inputValues).toEqual({
      inspection: entry.inspection
    });
    expect(windows[0].config.title).toBe(entry.inspection.title);
    expect(windows[0].config.initialSize).toEqual({ width: 600, height: 500 });
    expect(windows[0].config.minSize).toEqual({ width: 300, height: 200 });
  });

  it('gives the window no help button when the inspection names no docs', () => {
    presenter.show(makeEntry(), () => undefined);
    expect(windowService.windows()[0].config.help).toBeUndefined();
  });

  it("opens the inspection's docs section as it stands when help is pressed", () => {
    const open = vi
      .spyOn(TestBed.inject(DocumentationService), 'open')
      .mockImplementation(() => undefined);
    const inspection = new DocumentedInspection();
    presenter.show({ component: {} as Component, inspection }, () => undefined);
    const help = windowService.windows()[0].config.help;
    if (!isSignal(help)) throw new Error('expected a live help action');

    inspection.docs.set({ page: 'shortcuts', anchor: 'gamepad-keys' });
    (help() as LgHelpAction).command();
    expect(open).toHaveBeenCalledWith('shortcuts', 'gamepad-keys');
  });

  it('reports a user-driven window close as dismissed', () => {
    const entry = makeEntry();
    const dismissed = vi.fn();
    presenter.show(entry, dismissed);

    windowService.windows()[0].ref.close();
    expect(dismissed).toHaveBeenCalledTimes(1);
  });

  it('close() removes the window without reporting a dismissal', () => {
    const entry = makeEntry();
    const dismissed = vi.fn();
    presenter.show(entry, dismissed);

    presenter.close(entry);
    expect(windowService.windows()).toHaveLength(0);
    expect(dismissed).not.toHaveBeenCalled();
  });

  it('focus() raises the entry window in the stack', () => {
    const first = makeEntry();
    const second = makeEntry();
    presenter.show(first, () => undefined);
    presenter.show(second, () => undefined);
    const [firstWindow, secondWindow] = windowService.windows();
    expect(secondWindow.zIndex()).toBeGreaterThan(firstWindow.zIndex());

    presenter.focus(first);
    expect(firstWindow.zIndex()).toBeGreaterThan(secondWindow.zIndex());
  });
});
