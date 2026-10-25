import { beforeEach, describe, expect, it } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BitmapText } from 'pixi.js';
import { setStaticDIInjector } from '../../../utils/get-di';
import { Component } from '../../component';
import { BuiltInComponentType } from '@logigator/core';
import { inputComponentConfig } from './input.config';
import { InputComponent } from './input.component';

describe('InputComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
    setStaticDIInjector(TestBed.inject(Injector));
  });

  function create(options: Record<string, unknown> = {}): InputComponent {
    return Component.deserialize(
      { pos: [0, 0], options },
      inputComponentConfig
    ) as InputComponent;
  }

  it('has the INPUT type id (100)', () => {
    expect(inputComponentConfig.type).toBe(BuiltInComponentType.INPUT);
  });

  it('exposes exactly one output and no inputs', () => {
    const component = create();
    expect(component.numInputs).toBe(0);
    expect(component.numOutputs).toBe(1);
  });

  it('draws without error (renders children)', () => {
    const component = create({ label: 'A', index: 0 });
    expect(component.children.length).toBeGreaterThan(0);
  });

  // Every glyph the 1×1 body carries. The plug draws exactly one, so the whole
  // array pins both the text and the body's single-glyph layout.
  function bodyGlyphs(component: InputComponent): string[] {
    return component.children
      .filter((child) => child instanceof BitmapText)
      .map((text) => text.text);
  }

  it('renders the port name as the body glyph', () => {
    expect(bodyGlyphs(create({ label: 'CLK', index: 0 }))).toEqual(['CLK']);
  });

  it('falls back to the IN symbol while unnamed', () => {
    expect(bodyGlyphs(create({ label: '', index: 0 }))).toEqual([
      inputComponentConfig.symbol
    ]);
  });

  it('re-renders the glyph when the port is renamed', () => {
    const component = create({ label: '', index: 0 });

    component.options.label.value = 'D0';

    expect(bodyGlyphs(component)).toEqual(['D0']);
  });
});
