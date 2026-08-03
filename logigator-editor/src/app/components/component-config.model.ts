import { ComponentCategory } from './component-category.enum';
import { ComponentType } from './component-type.enum';
import { TranslationKey } from '../translation/translation-key.model';
import { ComponentOption } from './component-option';
import { ComponentAction } from './component-action';
import { ComponentInspection } from './component-inspection';
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
 * caller (e.g. `TranslationService.translate`) so this stays free of an Angular
 * dependency.
 */
export function resolveLocalizableText(
  value: LocalizableText,
  translate: (key: TranslationKey) => string
): string {
  return typeof value === 'string' ? translate(value) : value.literal;
}

/**
 * A palette tile's mini-shape, drawn instead of the text {@link
 * ComponentConfigView.symbol}. Only the built-ins whose canvas body is a drawn
 * shape rather than their symbol text carry one — for every other type the
 * symbol text *is* what appears on the board, so the text tile already previews
 * it. Custom components (user-authored symbols) never have one.
 *
 * Each config owns its geometry as SVG path data in an 18-unit box with the body
 * inset by one unit (the legacy editor's symbol-image convention), authored to
 * mirror that type's canvas body. Path data rather than markup: it binds through
 * `[attr.d]`, so the renderer stays a fixed two-path template — no case per
 * component type, and no `bypassSecurityTrustHtml` (Angular's sanitizer drops
 * SVG from `[innerHTML]` outright).
 */
export interface ComponentSymbolShape {
  /** Path data stroked in `currentColor` at a constant device width. */
  readonly stroke?: string;
  /** Path data filled with `currentColor`. */
  readonly fill?: string;
}

/**
 * Declarative map from a built-in's named options to the legacy positional `v0`
 * wire slots (`i`/`o`/`n`/`s`). Single source of truth for the permanent
 * `v0ToV1` file migration (decode) and the temporary server encoder (encode).
 * The `r` slot needs no entry — it always carries the component's first-class
 * `direction`, handled generically by both sides.
 *
 * FROZEN: it describes the *immutable* legacy `ProjectElement` format and names
 * **v1-era option keys**. If a live option is later renamed, do NOT edit this to
 * match — add a `v1→v2` migration instead. The mapping is purely positional;
 * a config needing computed legacy decode would handle it separately.
 */
export interface LegacyV0Slots {
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
  /**
   * Palette-tile mini-shape drawn in place of {@link symbol}. See
   * {@link ComponentSymbolShape} for which types carry one; `symbol` stays
   * populated either way (it is the search text and the v0/server metadata).
   */
  symbolShape?: ComponentSymbolShape;
  name: LocalizableText;
  description: LocalizableText;
  /**
   * Which library a custom component lives in — `'server'` (cloud) or
   * `'browser'` (local). A live view of its definition's source, so it tracks an
   * upload-to-cloud promotion. Absent on built-ins (which have no storage location).
   */
  source?: 'server' | 'browser';
  options: TOptions;
  /**
   * Valueless inspector actions (buttons) rendered after the options form, each
   * via its own renderer. Omitted by component types that contribute none.
   */
  actions?: ComponentAction[];
  /**
   * Builds the live inspection opened by tapping a placed instance during
   * simulation ({@link InspectionService}). Component types without one are
   * not inspectable.
   */
  inspection?(component: Component): ComponentInspection;
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
