import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComponentListComponent } from './component-list.component';
import { configureTestBed } from '../../../../testing/configure-test-bed';

describe('ComponentListComponent', () => {
  let component: ComponentListComponent;
  let fixture: ComponentFixture<ComponentListComponent>;

  beforeEach(() => {
    configureTestBed([], [ComponentListComponent]);

    fixture = TestBed.createComponent(ComponentListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows non-empty categories with all panels open by default', () => {
    const cats = component.categories();
    expect(cats.length).toBeGreaterThan(0);
    expect(cats.every((cat) => cat.components.length > 0)).toBe(true);
    // The basic gates are always present.
    expect(cats.some((cat) => cat.key === 'basic')).toBe(true);
    // Not searching: open state follows the manual default (everything open).
    expect(component.searchActive()).toBe(false);
    expect(component.openPanels()).toContain('basic');
  });

  it('drops every category when the search matches nothing', () => {
    component.searchText.set('zzz-no-such-component');
    expect(component.searchActive()).toBe(true);
    expect(component.categories()).toEqual([]);
    expect(component.openPanels()).toEqual([]);
  });

  it('auto-expands exactly the categories that survive the search', () => {
    component.searchText.set('zzz-no-such-component');
    expect(component.openPanels()).toEqual(
      component.categories().map((cat) => cat.key)
    );
  });

  it('honors manual expand/collapse while not searching', () => {
    component.onPanelChange(['basic']);
    expect(component.openPanels()).toEqual(['basic']);
  });

  it('ignores manual toggles while a search drives the open state', () => {
    component.searchText.set('zzz-no-such-component');
    component.onPanelChange(['basic']);
    // Search still owns the open state, so the manual toggle is discarded.
    expect(component.openPanels()).toEqual([]);
  });
});
