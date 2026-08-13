/**
 * Derives the automation catalog from the live component registry — never a
 * hand-written list, so a newly registered type (a freshly loaded custom
 * component included) shows up on the next call.
 *
 * The shape data all comes from `@logigator/core`: a built-in's config carries
 * the `ComponentMeta` it was composed from, so option constraints and port
 * counts are read rather than probed, and the API reports exactly what the
 * server would validate a document against.
 *
 * Pure functions over the registry's configs plus an injected translation
 * resolver, so the whole file is unit-testable without Angular.
 */

import {
  OptionSchema,
  validateOptionValue as validateAgainstSchema
} from '@logigator/core';
import {
  ComponentConfig,
  ComponentConfigView,
  resolveLocalizableText
} from '../components/component-config.model';
import { TranslationKey } from '../translation/translation-key.model';
import { CatalogEntry, OptionDescriptor } from './automation-api.model';

/** What the catalog needs from the app to resolve display text. */
export interface CatalogContext {
  translate: (key: TranslationKey) => string;
}

/**
 * Describes one option from its schema. The two select kinds collapse to a
 * single `select` descriptor: button-versus-dropdown is a rendering choice, and
 * the automation surface only cares which values are legal.
 */
export function describeOption(
  key: string,
  schema: OptionSchema,
  translate: (key: TranslationKey) => string
): OptionDescriptor {
  const base = {
    key,
    label: translate(schema.label as TranslationKey),
    hidden: schema.hidden === true
  };

  switch (schema.kind) {
    case 'number':
      return {
        ...base,
        kind: 'number',
        default: schema.default,
        min: schema.min,
        max: schema.max
      };
    case 'select-button':
    case 'select-dropdown':
      return {
        ...base,
        kind: 'select',
        default: schema.default,
        values: schema.values.map((v) => v.value)
      };
    case 'text':
      return {
        ...base,
        kind: 'text',
        default: schema.default,
        ...(schema.maxLength !== undefined
          ? { maxLength: schema.maxLength }
          : {}),
        ...(schema.forbiddenChars
          ? { forbiddenChars: schema.forbiddenChars }
          : {})
      };
    case 'textarea':
      return {
        ...base,
        kind: 'textarea',
        default: schema.default,
        maxLength: schema.maxLength
      };
    case 'memory':
      return { ...base, kind: 'memory', default: schema.default };
  }
}

/**
 * Why `value` is not acceptable for `config`'s `key` option, or `null` when it
 * is. The write paths reject rather than silently accept: the option setters
 * clamp numbers and strip characters on their own, so an unchecked write would
 * report success while storing something else.
 */
export function validateOptionValue(
  config: ComponentConfigView,
  key: string,
  value: unknown
): string | null {
  const schema = config.meta?.options[key];
  if (!schema) return `unknown option "${key}"`;
  return validateAgainstSchema(schema, value);
}

/** Every problem across `values`, joined, or `null` when they all pass. */
export function validateOptionValues(
  config: ComponentConfigView,
  values: Record<string, unknown>
): string | null {
  const problems: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    const message = validateOptionValue(config, key, value);
    if (message) problems.push(`option "${key}": ${message}`);
  }
  return problems.length > 0 ? problems.join('; ') : null;
}

/** Describes one registered component type. */
export function describeCatalogEntry(
  config: ComponentConfig,
  context: CatalogContext
): CatalogEntry {
  return {
    type: config.type,
    category: config.category,
    symbol: config.symbol,
    name: resolveLocalizableText(config.name, context.translate),
    description: resolveLocalizableText(config.description, context.translate),
    ...(config.source ? { source: config.source } : {}),
    ports: config.defaultPorts,
    options: Object.entries(config.meta?.options ?? {}).map(([key, schema]) =>
      describeOption(key, schema, context.translate)
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
