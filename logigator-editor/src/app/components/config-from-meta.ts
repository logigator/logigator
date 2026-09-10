import { ComponentMeta, OptionSchema, widenMeta } from '@logigator/core';
import {
  ComponentConfig,
  ComponentConfigView,
  ComponentSymbolShape
} from './component-config.model';
import { Component } from './component';
import { ComponentAction } from './component-action';
import { ComponentInspection } from './component-inspection';
import { ComponentOption } from './component-option';
import { TranslationKey } from '../translation/translation-key.model';
import { NumberComponentOption } from './component-options/number/number.component-option';
import { SelectButtonComponentOption } from './component-options/select-button/select-button.component-option';
import { SelectDropdownComponentOption } from './component-options/select-dropdown/select-dropdown.component-option';
import { TextInputComponentOption } from './component-options/text-input/text-input.component-option';
import { TextAreaComponentOption } from './component-options/text-area/text-area.component-option';
import { MemoryDataComponentOption } from './component-options/memory-data/memory-data.component-option';

/**
 * Meta owns everything both the editor and the server need — identity, option
 * schemas, arity, labels, body extent, legacy slots — and the editor supplies
 * the factory, the option renderers, the palette shape and the inspector
 * affordances.
 *
 * Translation keys are opaque `string`s in core, so the label casts below are
 * unchecked on their own; `meta-translation-keys.ts` asserts them against the
 * translation schema, re-exported here so the gate compiles wherever this does.
 */
export type { BuiltInTranslationKeysAreValid } from './meta-translation-keys';

/** The editor-only half of a built-in's config. */
export interface ConfigExtras<
  TOptions extends Record<string, ComponentOption>
> {
  create(options: TOptions): Component<TOptions>;
  symbolShape?: ComponentSymbolShape;
  actions?: ComponentAction[];
  inspection?(component: Component): ComponentInspection;
}

/** Instantiates the option class paired with `schema`'s kind. */
export function optionFromSchema(schema: OptionSchema): ComponentOption {
  const label = schema.label as TranslationKey;
  const option = buildOption(schema, label);
  return schema.hidden ? option.hideFromInspector() : option;
}

function buildOption(
  schema: OptionSchema,
  label: TranslationKey
): ComponentOption {
  switch (schema.kind) {
    case 'number':
      return new NumberComponentOption(
        label,
        schema.min,
        schema.max,
        schema.default
      );
    case 'select-button':
      return new SelectButtonComponentOption(
        label,
        schema.values.map((v) => ({ ...v })),
        schema.default
      );
    case 'select-dropdown':
      return new SelectDropdownComponentOption(
        label,
        schema.values.map((v) => ({ ...v })),
        schema.default
      );
    case 'text':
      return new TextInputComponentOption(label, schema.default, {
        placeholder: schema.placeholder as TranslationKey | undefined,
        maxLength: schema.maxLength,
        // Per config, not shared: a /g instance carries lastIndex between
        // the sanitizing calls on every write.
        forbiddenChars: schema.forbiddenChars
          ? new RegExp(schema.forbiddenChars, 'g')
          : undefined
      });
    case 'textarea':
      return new TextAreaComponentOption(label, schema.default, {
        dialogTitle: schema.dialogTitle as TranslationKey | undefined,
        placeholder: schema.placeholder as TranslationKey | undefined,
        maxLength: schema.maxLength
      });
    case 'memory':
      return new MemoryDataComponentOption(label, schema.default);
  }
}

/** One live option instance per schema, keyed the same way. */
export function optionsFromMeta(
  meta: ComponentMeta
): Record<string, ComponentOption> {
  return Object.fromEntries(
    Object.entries(meta.options).map(([key, schema]) => [
      key,
      optionFromSchema(schema)
    ])
  );
}

export function configFromMeta<
  TOptions extends Record<string, ComponentOption>
>(
  // `ComponentMeta<never>` is what a built-in's `as const` declaration is
  // assignable to; `widenMeta` explains why erasing the value shape here is
  // safe.
  source: ComponentMeta<never>,
  extras: ConfigExtras<TOptions>
): ComponentConfig<TOptions> {
  const meta = widenMeta(source);
  const options = optionsFromMeta(meta) as TOptions;
  const view: ComponentConfigView<TOptions> = {
    meta,
    type: meta.type,
    category: meta.category,
    symbol: meta.symbol,
    name: meta.name as TranslationKey,
    description: meta.description as TranslationKey,
    options,
    defaultPorts: meta.ports(
      Object.fromEntries(
        Object.entries(options).map(([key, option]) => [key, option.value])
      )
    ),
    legacyV0Slots: meta.legacyV0Slots,
    ...(extras.symbolShape ? { symbolShape: extras.symbolShape } : {}),
    ...(extras.actions ? { actions: extras.actions } : {}),
    ...(extras.inspection ? { inspection: extras.inspection } : {})
  };
  return { ...view, create: extras.create };
}
