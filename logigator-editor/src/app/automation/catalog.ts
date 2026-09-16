/**
 * Derives the automation catalog from the live component registry — never a
 * hand-written list, so a newly registered type (a freshly loaded custom
 * component included) shows up on the next call.
 *
 * Pure functions over the registry's configs plus two injected resolvers
 * (translation, logging), so the whole file is unit-testable without Angular.
 */

import {
  ComponentConfig,
  resolveLocalizableText
} from '../components/component-config.model';
import { Component } from '../components/component';
import { ComponentOption } from '../components/component-option';
import { NumberComponentOption } from '../components/component-options/number/number.component-option';
import { SelectButtonComponentOption } from '../components/component-options/select-button/select-button.component-option';
import { SelectDropdownComponentOption } from '../components/component-options/select-dropdown/select-dropdown.component-option';
import { TextInputComponentOption } from '../components/component-options/text-input/text-input.component-option';
import { TextAreaComponentOption } from '../components/component-options/text-area/text-area.component-option';
import { MemoryDataComponentOption } from '../components/component-options/memory-data/memory-data.component-option';
import { TranslationKey } from '../translation/translation-key.model';
import { CatalogEntry, OptionDescriptor } from './automation-api.model';

/** What the catalog needs from the app to resolve display text. */
export interface CatalogContext {
  translate: (key: TranslationKey) => string;
  /** Reported when a type cannot be probed for its port counts. */
  warn: (message: string) => void;
}

/**
 * Describes one option, discriminating on its class. `instanceof` rather than a
 * `kind` field on {@link ComponentOption}: the option classes carry their
 * constraints in class-specific fields, and this is the only consumer that
 * needs them enumerated.
 */
export function describeOption(
  key: string,
  option: ComponentOption,
  translate: (key: TranslationKey) => string
): OptionDescriptor {
  const base = {
    key,
    label: translate(option.label),
    hidden: option.inspectorHidden
  };

  if (option instanceof NumberComponentOption) {
    return {
      ...base,
      kind: 'number',
      default: option.value,
      min: option.min,
      max: option.max
    };
  }
  if (
    option instanceof SelectButtonComponentOption ||
    option instanceof SelectDropdownComponentOption
  ) {
    return {
      ...base,
      kind: 'select',
      default: option.value as unknown,
      values: (option.options as { value: unknown }[]).map((o) => o.value)
    };
  }
  if (option instanceof TextInputComponentOption) {
    return {
      ...base,
      kind: 'text',
      default: option.value,
      ...(option.maxLength !== undefined
        ? { maxLength: option.maxLength }
        : {}),
      // A RegExp does not survive structured cloning usefully — send its source.
      ...(option.forbiddenChars
        ? { forbiddenChars: option.forbiddenChars.source }
        : {})
    };
  }
  if (option instanceof TextAreaComponentOption) {
    return {
      ...base,
      kind: 'textarea',
      default: option.value,
      maxLength: option.maxLength
    };
  }
  if (option instanceof MemoryDataComponentOption) {
    return { ...base, kind: 'memory', default: option.value };
  }
  return { ...base, kind: 'unknown', default: option.value as unknown };
}

/**
 * Why `value` is not acceptable for `option`, or `null` when it is. The write
 * paths reject rather than silently accept: the option setters clamp numbers and
 * strip characters on their own, so an unchecked write would report success
 * while storing something else.
 */
export function validateOptionValue(
  option: ComponentOption,
  value: unknown
): string | null {
  if (option instanceof NumberComponentOption) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 'expected a finite number';
    }
    // Numeric options are integer-valued and round on write, so a fraction
    // would be stored as something other than what was sent.
    if (!Number.isInteger(value)) {
      return 'expected an integer';
    }
    if (value < option.min || value > option.max) {
      return `out of range [${option.min}, ${option.max}]`;
    }
    return null;
  }
  if (
    option instanceof SelectButtonComponentOption ||
    option instanceof SelectDropdownComponentOption
  ) {
    const values = (option.options as { value: unknown }[]).map((o) => o.value);
    return values.includes(value)
      ? null
      : `not one of ${JSON.stringify(values)}`;
  }
  if (option instanceof TextInputComponentOption) {
    if (typeof value !== 'string') return 'expected a string';
    if (option.maxLength !== undefined && value.length > option.maxLength) {
      return `longer than ${option.maxLength} characters`;
    }
    // A fresh RegExp: a shared /g instance carries lastIndex between tests.
    if (
      option.forbiddenChars &&
      new RegExp(option.forbiddenChars.source).test(value)
    ) {
      return `contains forbidden characters (/${option.forbiddenChars.source}/)`;
    }
    return null;
  }
  if (option instanceof TextAreaComponentOption) {
    if (typeof value !== 'string') return 'expected a string';
    return value.length > option.maxLength
      ? `longer than ${option.maxLength} characters`
      : null;
  }
  if (option instanceof MemoryDataComponentOption) {
    return typeof value === 'string' ? null : 'expected a base64 blob string';
  }
  return null;
}

/**
 * Port counts of a default instance of `config`. The counts are a constructor
 * argument of each component subclass, not config data, so the only faithful
 * way to read them is to build a throwaway instance and drop it again.
 * Returns `undefined` (with a warning) if construction fails, so one broken
 * type never sinks the whole catalog.
 */
function probePorts(
  config: ComponentConfig,
  warn: (message: string) => void
): { inputs: number; outputs: number } | undefined {
  let instance: Component | undefined;
  try {
    instance = config.create(
      Object.fromEntries(
        Object.entries(config.options).map(([key, proto]) => [
          key,
          proto.clone()
        ])
      )
    );
    return { inputs: instance.numInputs, outputs: instance.numOutputs };
  } catch (err) {
    warn(`could not probe port counts of type ${config.type}: ${String(err)}`);
    return undefined;
  } finally {
    instance?.destroy({ children: true });
  }
}

/** Describes one registered component type. */
export function describeCatalogEntry(
  config: ComponentConfig,
  context: CatalogContext
): CatalogEntry {
  const ports = probePorts(config, context.warn);
  return {
    type: config.type,
    category: config.category,
    symbol: config.symbol,
    name: resolveLocalizableText(config.name, context.translate),
    description: resolveLocalizableText(config.description, context.translate),
    ...(config.source ? { source: config.source } : {}),
    ...(ports ? { ports } : {}),
    options: Object.entries(config.options).map(([key, option]) =>
      describeOption(key, option, context.translate)
    )
  };
}

/** Describes every given type, type id ascending (stable across calls). */
export function describeCatalog(
  configs: Iterable<ComponentConfig>,
  context: CatalogContext
): CatalogEntry[] {
  return [...configs]
    .map((config) => describeCatalogEntry(config, context))
    .sort((a, b) => a.type - b.type);
}
