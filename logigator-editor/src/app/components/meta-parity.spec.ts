import { beforeEach, describe, expect, it } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BUILT_IN_META,
  ComponentMeta,
  Direction,
  OptionSchema
} from '@logigator/core';
import { setStaticDIInjector } from '../utils/get-di';
import { configureTestBed } from '../../testing/configure-test-bed';
import { Component } from './component';
import { ComponentProviderService } from './component-provider.service';

/**
 * `ComponentMeta` and the `Component` subclasses derive port arity, port labels
 * and body extent from the same option values by two independent routes — a
 * pure function in core and the class's own getters. Nothing makes them agree
 * yet, so this spec walks every built-in across sampled option values and
 * checks that they do.
 *
 * It retires when `Component` reads its meta directly and the per-class getters
 * are deleted: at that point there is only one route left to disagree with.
 */

/** The protected geometry the parity check reads off a live instance. */
interface GeometryProbe {
  inputLabels: string[];
  outputLabels: string[];
  bodyGridWidth: number;
  bodyGridHeight: number;
}

const DIRECTIONS = [Direction.E, Direction.S, Direction.W, Direction.N];

/**
 * Values worth trying for one option: the extremes plus something in between,
 * since the arity rules are `1 << n`-shaped and a mid value catches an
 * off-by-one a boundary pair would not.
 */
function sampleValues(schema: OptionSchema): unknown[] {
  switch (schema.kind) {
    case 'number':
      return [
        ...new Set([
          schema.min,
          Math.min(schema.max, Math.floor((schema.min + schema.max) / 2)),
          // The upper bounds are enormous for a few types (a clock's speed is
          // MAX_SAFE_INTEGER), and nothing derives geometry from them, so cap
          // the sample at a size a real board would hold.
          Math.min(schema.max, 64)
        ])
      ];
    case 'select-button':
    case 'select-dropdown':
      return schema.values.map((v) => v.value);
    default:
      return [schema.default];
  }
}

/** Every combination of the sampled values, option by option. */
function sampleOptionValues(meta: ComponentMeta): Record<string, unknown>[] {
  let combinations: Record<string, unknown>[] = [{}];
  for (const [key, schema] of Object.entries(meta.options)) {
    combinations = combinations.flatMap((base) =>
      sampleValues(schema).map((value) => ({ ...base, [key]: value }))
    );
  }
  return combinations;
}

describe('ComponentMeta parity with the live component classes', () => {
  let provider: ComponentProviderService;

  beforeEach(() => {
    configureTestBed();
    setStaticDIInjector(TestBed.inject(Injector));
    provider = TestBed.inject(ComponentProviderService);
  });

  it('covers every registered built-in', () => {
    const registered = provider
      .allComponents()
      .map((config) => config.type)
      .sort((a, b) => a - b);
    expect(BUILT_IN_META.map((m) => m.type).sort((a, b) => a - b)).toEqual(
      registered
    );
  });

  for (const meta of BUILT_IN_META) {
    describe(`type ${meta.type} (${meta.symbol})`, () => {
      it('reports the same arity, labels and body as its instances', () => {
        const config = provider.getComponent(meta.type);
        expect(config).toBeDefined();

        for (const values of sampleOptionValues(meta)) {
          for (const direction of DIRECTIONS) {
            const component = Component.deserialize(
              { pos: [0, 0], options: values, direction },
              config!
            );
            const probe = component as unknown as GeometryProbe;
            const context = `${meta.symbol} ${JSON.stringify(values)} dir ${direction}`;

            expect(
              { inputs: component.numInputs, outputs: component.numOutputs },
              context
            ).toEqual(meta.ports(values));
            expect(
              { inputs: probe.inputLabels, outputs: probe.outputLabels },
              context
            ).toEqual(meta.labels(values));
            expect(
              { width: probe.bodyGridWidth, height: probe.bodyGridHeight },
              context
            ).toEqual(meta.body(values, direction));

            component.destroy({ children: true });
          }
        }
      });
    });
  }
});
