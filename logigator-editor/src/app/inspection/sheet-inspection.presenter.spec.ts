import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signal, Type } from '@angular/core';
import { Component } from '../components/component';
import { ComponentInspection } from '../components/component-inspection';
import { OpenInspection } from './inspection-presenter';
import { SheetInspectionPresenter } from './sheet-inspection.presenter';

class TestInspection extends ComponentInspection {
  readonly renderer = {} as Type<unknown>;
  readonly title = signal('test');
}

function makeEntry(): OpenInspection {
  return { component: {} as Component, inspection: new TestInspection() };
}

describe('SheetInspectionPresenter', () => {
  let presenter: SheetInspectionPresenter;

  beforeEach(() => {
    presenter = new SheetInspectionPresenter();
  });

  it('shows entries as tabs with the newest one active', () => {
    const first = makeEntry();
    const second = makeEntry();
    presenter.show(first, () => undefined);
    presenter.show(second, () => undefined);

    expect(presenter.entries()).toEqual([first, second]);
    expect(presenter.active()).toBe(second);
  });

  it('focus() switches the active tab', () => {
    const first = makeEntry();
    presenter.show(first, () => undefined);
    presenter.show(makeEntry(), () => undefined);

    presenter.focus(first);
    expect(presenter.active()).toBe(first);

    // Unknown entries are ignored.
    presenter.focus(makeEntry());
    expect(presenter.active()).toBe(first);
  });

  it('close() removes one entry and moves the active tab along', () => {
    const first = makeEntry();
    const second = makeEntry();
    const dismissed = vi.fn();
    presenter.show(first, dismissed);
    presenter.show(second, dismissed);

    presenter.close(second);
    expect(presenter.entries()).toEqual([first]);
    expect(presenter.active()).toBe(first);
    expect(dismissed).not.toHaveBeenCalled();

    presenter.close(first);
    expect(presenter.entries()).toEqual([]);
    expect(presenter.active()).toBeNull();
  });

  it('dismissAll() empties the sheet and reports every dismissal', () => {
    const dismissals: OpenInspection[] = [];
    const first = makeEntry();
    const second = makeEntry();
    presenter.show(first, () => dismissals.push(first));
    presenter.show(second, () => dismissals.push(second));

    presenter.dismissAll();
    expect(presenter.entries()).toEqual([]);
    expect(presenter.active()).toBeNull();
    expect(dismissals).toEqual([first, second]);
  });
});
