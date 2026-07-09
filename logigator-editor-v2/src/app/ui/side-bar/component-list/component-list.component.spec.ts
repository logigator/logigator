import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComponentListComponent } from './component-list.component';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { CustomComponentRegistry } from '../../../components/custom/custom-component-registry.service';

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

  it('orders user components newest-edited first', () => {
    const registry = TestBed.inject(CustomComponentRegistry);
    const older = registry.createMaster(
      { symbol: 'O', name: 'Older', lastEdited: 1000 },
      'browser'
    );
    const newer = registry.createMaster(
      { symbol: 'N', name: 'Newer', lastEdited: 2000 },
      'browser'
    );

    const order = component.userComponents().map((config) => config.type);
    expect(order.indexOf(newer)).toBeLessThan(order.indexOf(older));
  });

  it('re-sorts a master to the top when it is re-stamped as edited', () => {
    const registry = TestBed.inject(CustomComponentRegistry);
    const a = registry.createMaster(
      { symbol: 'A', name: 'A', lastEdited: 1000 },
      'browser'
    );
    const b = registry.createMaster(
      { symbol: 'B', name: 'B', lastEdited: 2000 },
      'browser'
    );
    expect(component.userComponents()[0].type).toBe(b);

    registry.setMasterLastEdited(a, 3000);
    expect(component.userComponents()[0].type).toBe(a);
  });
});
