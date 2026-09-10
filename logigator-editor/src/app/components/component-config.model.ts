import {
  ComponentCategory,
  ComponentMeta,
  ComponentType,
  LegacyV0Slots,
  Ports
} from '@logigator/core';
import { TranslationKey } from '../translation/translation-key.model';
import { ComponentOption } from './component-option';
import { ComponentAction } from './component-action';
import { ComponentInspection } from './component-inspection';
import { Component } from './component';

/**
 * A built-in's {@link TranslationKey} or a custom component's user-authored
 * `literal`. The literal arm keeps key typing strict for built-ins while
 * letting runtime strings opt out of the translation schema.
 */
export type LocalizableText = TranslationKey | { readonly literal: string };

/** `translate` is passed in so this stays free of an Angular dependency. */
export function resolveLocalizableText(
  value: LocalizableText,
  translate: (key: TranslationKey) => string
): string {
  return typeof value === 'string' ? translate(value) : value.literal;
}

/**
 * A palette tile's mini-shape, drawn instead of the text symbol. Only types
 * whose canvas body is a drawn shape rather than their symbol text carry one;
 * elsewhere the symbol text *is* what appears on the board, so the text tile
 * already previews it.
 *
 * Geometry is SVG path data in an 18-unit box with the body inset by one unit
 * (the legacy editor's symbol-image convention). Path data rather than markup
 * so it binds through `[attr.d]`: the renderer stays one two-path template,
 * and Angular's sanitizer drops SVG from `[innerHTML]` outright.
 */
export interface ComponentSymbolShape {
  /** Path data stroked in `currentColor` at a constant device width. */
  readonly stroke?: string;
  /** Path data filled with `currentColor`. */
  readonly fill?: string;
}

export interface ComponentConfigView<
  TOptions extends Record<string, ComponentOption> = Record<
    string,
    ComponentOption
  >
> {
  /**
   * The pure catalog data this config is composed from. Present on every
   * built-in, absent on custom components, whose definition *is* that data.
   */
  meta?: ComponentMeta;
  type: ComponentType;
  category: ComponentCategory;
  symbol: string;
  /**
   * Drawn in place of {@link symbol}, which stays populated either way: it is
   * the search text and the v0/server metadata.
   */
  symbolShape?: ComponentSymbolShape;
  name: LocalizableText;
  description: LocalizableText;
  /**
   * Which library a custom component lives in. A live view of its definition's
   * source, so it tracks an upload-to-cloud promotion.
   */
  source?: 'server' | 'browser';
  options: TOptions;
  /**
   * Port counts an instance built from the default option values has, answered
   * without constructing one.
   */
  defaultPorts: Ports;
  /** Valueless inspector actions rendered after the options form. */
  actions?: ComponentAction[];
  /**
   * Builds the live inspection opened by tapping an instance during
   * simulation. Types without one are not inspectable.
   */
  inspection?(component: Component): ComponentInspection;
  /** Present on built-ins that exist in the v0 format; v0 has no customs. */
  legacyV0Slots?: LegacyV0Slots;
}

export interface ComponentConfig<
  TOptions extends Record<string, ComponentOption> = Record<
    string,
    ComponentOption
  >
> extends ComponentConfigView<TOptions> {
  /**
   * A factory rather than a constructor reference, so a config can close over
   * per-definition state such as a custom component's definition.
   */
  create(options: TOptions): Component<TOptions>;
}
