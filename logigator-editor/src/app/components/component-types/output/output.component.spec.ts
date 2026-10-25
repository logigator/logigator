import { beforeEach, describe, expect, it } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BitmapText } from 'pixi.js';
import { setStaticDIInjector } from '../../../utils/get-di';
import { Component } from '../../component';
import { BuiltInComponentType } from '@logigator/core';
import { outputComponentConfig } from './output.config';
import { OutputComponent } from './output.component';

describe('OutputComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
    setStaticDIInjector(TestBed.inject(Injector));
  });

  function create(options: Record<string, unknown> = {}): OutputComponent {
    return Component.deserialize(
      { pos: [0, 0], options },
      outputComponentConfig
    ) as OutputComponent;
  }

  it('has the OUTPUT type id (101)', () => {
    expect(outputComponentConfig.type).toBe(BuiltInComponentType.OUTPUT);
  });

  it('exposes exactly one input and no outputs', () => {
    const component = create();
    expect(component.numInputs).toBe(1);
    expect(component.numOutputs).toBe(0);
  });

  it('draws without error (renders children)', () => {
    const component = create({ label: 'Q', index: 0 });
    expect(component.children.length).toBeGreaterThan(0);
  });

  // Every glyph the 1×1 body carries. The plug draws exactly one, so the whole
  // array pins both the text and the body's single-glyph layout.
  function bodyGlyphs(component: OutputComponent): string[] {
    return component.children
      .filter((child) => child instanceof BitmapText)
      .map((text) => text.text);
  }

  it('renders the port name as the body glyph', () => {
    expect(bodyGlyphs(create({ label: 'Q', index: 0 }))).toEqual(['Q']);
  });

  it('falls back to the OUT symbol while unnamed', () => {
    expect(bodyGlyphs(create({ label: '', index: 0 }))).toEqual([
      outputComponentConfig.symbol
    ]);
  });

  it('re-renders the glyph when the port is renamed', () => {
    const component = create({ label: '', index: 0 });

    component.options.label.value = 'Y1';

    expect(bodyGlyphs(component)).toEqual(['Y1']);
  });
});
