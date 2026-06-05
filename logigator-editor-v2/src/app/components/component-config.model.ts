import { ComponentCategory } from './component-category.enum';
import { ComponentType } from './component-type.enum';
import { TranslationKey } from '../translation/translation-key.model';
import { ComponentOption } from './component-option';
import { ComponentAction } from './component-action';
import { Component } from './component';

/**
 * Display text that is either a built-in's {@link TranslationKey} (resolved
 * through the translation service) or a custom component's user-authored
 * `literal` string (shown verbatim). The literal arm keeps key typing strict for
 * built-ins while letting runtime strings opt out of the translation schema.
 */
export type LocalizableText = TranslationKey | { readonly literal: string };

/**
 * Resolves {@link LocalizableText} to a display string: a key is run through
 * `translate`, a literal is returned verbatim. `translate` is supplied by the
 * caller (e.g. `TranslocoService.translate`) so this stays free of an Angular
 * dependency.
 */
export function resolveLocalizableText(
  value: LocalizableText,
  translate: (key: TranslationKey) => string
): string {
  return typeof value === 'string' ? translate(value) : value.literal;
}

/**
 * Declarative map from a built-in's named options to the legacy positional `v0`
 * wire slots (`r`/`i`/`o`/`n`/`s`). Single source of truth for the permanent
 * `v0ToV1` file migration (decode) and the temporary server encoder (encode).
 *
 * FROZEN: it describes the *immutable* legacy `ProjectElement` format and names
 * **v1-era option keys**. If a live option is later renamed, do NOT edit this to
 * match — add a `v1→v2` migration instead. The mapping is purely positional;
 * a config needing computed legacy decode would handle it separately.
 */
export interface LegacyV0Slots {
  /** Option populated from `element.r` (rotation/direction). */
  r?: string;
  /** Option populated from `element.i` (input count). */
  i?: string;
  /** Option populated from `element.o` (output count). */
  o?: string;
  /** Options consuming `element.n[0]`, `n[1]`, … in declaration order. */
  n?: string[];
  /** The single option consuming `element.s`. */
  s?: string;
}

export interface ComponentConfigView<
  TOptions extends Record<string, ComponentOption> = Record<
    string,
    ComponentOption
  >
> {
  type: ComponentType;
  category: ComponentCategory;
  symbol: string;
  name: LocalizableText;
  description: LocalizableText;
  options: TOptions;
  /**
   * Valueless inspector actions (buttons) rendered after the options form, each
   * via its own renderer. Omitted by component types that contribute none.
   */
  actions?: ComponentAction[];
  /**
   * Legacy positional wire-slot descriptor — present on built-ins that exist in
   * the v0 format, absent on custom components (v0 has no customs). See
   * {@link LegacyV0Slots}.
   */
  legacyV0Slots?: LegacyV0Slots;
}

export interface ComponentConfig<
  TOptions extends Record<string, ComponentOption> = Record<
    string,
    ComponentOption
  >
> extends ComponentConfigView<TOptions> {
  /**
   * Builds a component instance from its options. A factory (rather than a
   * constructor reference) so a config can close over per-definition state,
   * such as a custom component's definition.
   */
  create(options: TOptions): Component<TOptions>;
}
