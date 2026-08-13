import { beforeEach, describe, expect, it } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { setStaticDIInjector } from '../utils/get-di';
import { ComponentProviderService } from '../components/component-provider.service';
import {
  andMeta,
  BuiltInComponentType,
  ComponentCategory,
  inputMeta,
  ledMatrixMeta,
  romMeta
} from '@logigator/core';
import { ComponentConfig } from '../components/component-config.model';
import { NotComponent } from '../components/component-types/not/not.component';
import { CatalogContext, describeCatalog, describeOption } from './catalog';

const CONTEXT: CatalogContext = { translate: (key) => key };

describe('automation catalog', () => {
  let provider: ComponentProviderService;

  beforeEach(() => {
    configureTestBed();
    setStaticDIInjector(TestBed.inject(Injector));
    provider = TestBed.inject(ComponentProviderService);
  });

  it('describes every registered type, without a hand-written list', () => {
    const entries = describeCatalog(provider.allComponents(), CONTEXT);
    const described = new Set(entries.map((e) => e.type));
    for (const config of provider.allComponents()) {
      expect(described).toContain(config.type);
    }
    expect(entries.length).toBe(provider.allComponents().length);
  });

  it('picks up a type registered after the last call', () => {
    const config: ComponentConfig = {
      type: 4321,
      category: ComponentCategory.USER,
      symbol: 'MY',
      name: { literal: 'My Component' },
      description: { literal: 'A runtime custom' },
      source: 'browser',
      options: {},
      defaultPorts: { inputs: 2, outputs: 1 },
      create: () => new NotComponent({})
    };
    expect(
      describeCatalog(provider.allComponents(), CONTEXT).some(
        (e) => e.type === 4321
      )
    ).toBe(false);

    provider.register(config);

    const entry = describeCatalog(provider.allComponents(), CONTEXT).find(
      (e) => e.type === 4321
    );
    expect(entry?.name).toBe('My Component');
    expect(entry?.source).toBe('browser');
    // A custom type reports its definition's counts rather than a meta's.
    expect(entry?.ports).toEqual({ inputs: 2, outputs: 1 });
  });

  it("reports a type's default port counts", () => {
    const entries = describeCatalog(provider.allComponents(), CONTEXT);
    const and = entries.find((e) => e.type === BuiltInComponentType.AND);
    // AND defaults to two inputs and one output.
    expect(and?.ports).toEqual({ inputs: 2, outputs: 1 });
  });

  describe('describeOption', () => {
    it("carries a number option's range", () => {
      expect(
        describeOption('numInputs', andMeta.options.numInputs, (key) => key)
      ).toMatchObject({
        kind: 'number',
        min: andMeta.options.numInputs.min,
        max: andMeta.options.numInputs.max,
        default: andMeta.options.numInputs.default
      });
    });

    it('flattens both select kinds to one descriptor carrying the allowed values', () => {
      expect(
        describeOption('size', ledMatrixMeta.options.size, (key) => key)
      ).toMatchObject({
        kind: 'select',
        values: [4, 8, 16],
        default: 4
      });
    });

    it("sends a text option's forbidden characters as a cloneable string", () => {
      expect(
        describeOption('label', inputMeta.options.label, (key) => key)
      ).toMatchObject({
        kind: 'text',
        maxLength: 5,
        forbiddenChars: ','
      });
    });

    it('marks an inspector-hidden option as hidden', () => {
      expect(
        describeOption('index', inputMeta.options.index, (key) => key)
      ).toMatchObject({ kind: 'number', hidden: true });
      expect(
        describeOption('data', romMeta.options.data, (key) => key)
      ).toMatchObject({ kind: 'memory', hidden: false });
    });
  });
});
