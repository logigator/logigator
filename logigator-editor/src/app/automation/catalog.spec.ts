import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { setStaticDIInjector } from '../utils/get-di';
import { ComponentProviderService } from '../components/component-provider.service';
import { BuiltInComponentType } from '@logigator/core';
import { ComponentCategory } from '../components/component-category.enum';
import { ComponentConfig } from '../components/component-config.model';
import { NotComponent } from '../components/component-types/not/not.component';
import { NumberComponentOption } from '../components/component-options/number/number.component-option';
import { SelectButtonComponentOption } from '../components/component-options/select-button/select-button.component-option';
import { TextInputComponentOption } from '../components/component-options/text-input/text-input.component-option';
import { MemoryDataComponentOption } from '../components/component-options/memory-data/memory-data.component-option';
import { andComponentConfig } from '../components/component-types/and/and.config';
import { CatalogContext, describeCatalog, describeOption } from './catalog';

const CONTEXT: CatalogContext = {
  translate: (key) => key,
  warn: () => {
    /* silent in tests */
  }
};

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
  });

  it('probes port counts from a default instance', () => {
    const entries = describeCatalog(provider.allComponents(), CONTEXT);
    const and = entries.find((e) => e.type === BuiltInComponentType.AND);
    // AND defaults to two inputs and one output.
    expect(and?.ports).toEqual({ inputs: 2, outputs: 1 });
  });

  it('reports — rather than throws on — a type that cannot be instantiated', () => {
    const warn = vi.fn();
    const broken: ComponentConfig = {
      type: 4322,
      category: ComponentCategory.USER,
      symbol: 'B',
      name: { literal: 'Broken' },
      description: { literal: '' },
      options: {},
      create: () => {
        throw new Error('nope');
      }
    };
    provider.register(broken);

    const entry = describeCatalog(provider.allComponents(), {
      ...CONTEXT,
      warn
    }).find((e) => e.type === 4322);
    expect(entry?.ports).toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
  });

  describe('describeOption', () => {
    it("carries a number option's range", () => {
      const descriptor = describeOption(
        'numInputs',
        andComponentConfig.options.numInputs,
        (key) => key
      );
      expect(descriptor.kind).toBe('number');
      expect(descriptor).toMatchObject({
        min: (andComponentConfig.options.numInputs as NumberComponentOption)
          .min,
        max: (andComponentConfig.options.numInputs as NumberComponentOption).max
      });
    });

    it("carries a select option's allowed values", () => {
      const option = new SelectButtonComponentOption(
        'settings.options.showGrid',
        [{ value: 'a' }, { value: 'b' }],
        'a'
      );
      expect(describeOption('mode', option, (key) => key)).toMatchObject({
        kind: 'select',
        values: ['a', 'b'],
        default: 'a'
      });
    });

    it("sends a text option's forbidden characters as a cloneable string", () => {
      const option = new TextInputComponentOption(
        'components.def.AND.name',
        '',
        {
          maxLength: 5,
          forbiddenChars: /,/g
        }
      );
      expect(describeOption('label', option, (key) => key)).toMatchObject({
        kind: 'text',
        maxLength: 5,
        forbiddenChars: ','
      });
    });

    it('marks an inspector-hidden option as hidden', () => {
      const option = new MemoryDataComponentOption(
        'components.def.ROM.name'
      ).hideFromInspector();
      expect(describeOption('data', option, (key) => key)).toMatchObject({
        kind: 'memory',
        hidden: true
      });
    });
  });
});
