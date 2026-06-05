import { describe, beforeEach, it, expect, vi } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { setStaticDIInjector } from '../../../utils/get-di';
import { Component } from '../../component';
import { BuiltInComponentType } from '../../component-type.enum';
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

  it('tolerates label option changes without error', () => {
    const component = create({ label: 'A', index: 0 });
    expect(() => (component.options.label.value = 'B')).not.toThrow();
    expect(component.options.label.value).toBe('B');
    expect(component.children.length).toBeGreaterThan(0);
  });
});
