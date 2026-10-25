import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import {
  ComponentListComponent,
  PALETTE_COLLAPSED_STORAGE_KEY
} from './component-list.component';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { CustomComponentRegistry } from '../../../components/custom/custom-component-registry.service';
import { BuiltInComponentType, ComponentCategory } from '@logigator/core';

describe('ComponentListComponent', () => {
  let component: ComponentListComponent;
  let fixture: ComponentFixture<ComponentListComponent>;

  beforeEach(() => {
    configureTestBed([], [ComponentListComponent]);

    fixture = TestBed.createComponent(ComponentListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.removeItem(PALETTE_COLLAPSED_STORAGE_KEY);
  });

  function remount(): ComponentListComponent {
    return TestBed.createComponent(ComponentListComponent).componentInstance;
  }

  it('shows non-empty categories with all panels open by default', () => {
    const cats = component.categories();
    expect(cats.length).toBeGreaterThan(0);
    expect(cats.every((cat) => cat.components.length > 0)).toBe(true);
    // Not searching: open state follows the manual default (everything open).
    expect(component.searchActive()).toBe(false);
    for (const cat of cats) {
      expect(component.openPanels()).toContain(cat.key);
    }
  });

  it('lists the built-ins by category, in palette order', () => {
    const T = BuiltInComponentType;
    expect(
      component.categories().map((cat) => ({
        key: cat.key,
        types: cat.components.map((config) => config.type)
      }))
    ).toEqual([
      {
        key: ComponentCategory.LOGIC_GATES,
        types: [T.NOT, T.AND, T.OR, T.XOR, T.TUNNEL]
      },
      {
        key: ComponentCategory.INPUTS,
        types: [T.SWITCH, T.BUTTON, T.PULSE_BUTTON, T.GAMEPAD, T.KEYBOARD]
      },
      {
        key: ComponentCategory.OUTPUTS,
        types: [T.LED, T.SEGMENT_DISPLAY, T.LED_MATRIX, T.TERMINAL]
      },
      {
        key: ComponentCategory.ADDERS_SELECTORS,
        types: [
          T.HALF_ADDER,
          T.FULL_ADDER,
          T.MUX,
          T.DEMUX,
          T.DECODER,
          T.ENCODER
        ]
      },
      {
        key: ComponentCategory.MEMORY,
        types: [T.D_FF, T.JK_FF, T.SR_FF, T.ROM, T.RAM]
      },
      { key: ComponentCategory.TIMING, types: [T.CLOCK, T.DELAY, T.RNG] }
    ]);
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
    component.onPanelChange([ComponentCategory.MEMORY]);
    expect(component.openPanels()).toEqual([ComponentCategory.MEMORY]);
  });

  it('keeps folded categories folded in the next session', () => {
    component.onPanelChange([ComponentCategory.LOGIC_GATES]);
    expect(remount().openPanels()).toEqual([ComponentCategory.LOGIC_GATES]);
  });

  it('opens a category that was never folded', () => {
    // Stored before User Components existed in the palette.
    localStorage.setItem(
      PALETTE_COLLAPSED_STORAGE_KEY,
      JSON.stringify([ComponentCategory.MEMORY])
    );
    const open = remount().openPanels();
    expect(open).not.toContain(ComponentCategory.MEMORY);
    expect(open).toContain(ComponentCategory.USER);
  });

  it('opens everything when the stored value is corrupt', () => {
    localStorage.setItem(PALETTE_COLLAPSED_STORAGE_KEY, '{not json');
    const fresh = remount();
    expect(fresh.openPanels()).toEqual(
      expect.arrayContaining(fresh.categories().map((cat) => cat.key))
    );
  });

  it('ignores manual toggles while a search drives the open state', () => {
    component.searchText.set('zzz-no-such-component');
    component.onPanelChange([ComponentCategory.MEMORY]);
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
