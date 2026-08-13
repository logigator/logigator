import {
  andMeta,
  buttonMeta,
  clockMeta,
  dFfMeta,
  decoderMeta,
  delayMeta,
  demuxMeta,
  encoderMeta,
  fullAdderMeta,
  halfAdderMeta,
  inputMeta,
  jkFfMeta,
  ledMatrixMeta,
  ledMeta,
  muxMeta,
  notMeta,
  orMeta,
  outputMeta,
  ramMeta,
  rngMeta,
  romMeta,
  segmentDisplayMeta,
  srFfMeta,
  switchMeta,
  textMeta,
  tunnelMeta,
  xorMeta
} from '@logigator/core';
import { TranslationKey } from '../translation/translation-key.model';

/**
 * Compile-time gate on the display text that lives in `@logigator/core`.
 *
 * Core knows nothing about the editor's translation schema, so a meta's `name`,
 * `description` and option labels are opaque `string`s there. Each meta is
 * declared with `satisfies`, though, so its literal key types survive — and
 * this file collects them into one union and asserts it against
 * {@link TranslationKey}. A typo, or a key removed from the locale files, fails
 * the editor's type check rather than rendering as a raw key at runtime.
 */

interface TranslatableMeta {
  readonly name: string;
  readonly description: string;
  readonly options: Readonly<Record<string, { readonly label: string }>>;
}

/** Every display string one meta contributes. */
type MetaKeys<M extends TranslatableMeta> =
  M['name'] | M['description'] | M['options'][keyof M['options']]['label'];

export type BuiltInTranslationKeys =
  | MetaKeys<typeof andMeta>
  | MetaKeys<typeof buttonMeta>
  | MetaKeys<typeof clockMeta>
  | MetaKeys<typeof dFfMeta>
  | MetaKeys<typeof decoderMeta>
  | MetaKeys<typeof delayMeta>
  | MetaKeys<typeof demuxMeta>
  | MetaKeys<typeof encoderMeta>
  | MetaKeys<typeof fullAdderMeta>
  | MetaKeys<typeof halfAdderMeta>
  | MetaKeys<typeof inputMeta>
  | MetaKeys<typeof jkFfMeta>
  | MetaKeys<typeof ledMatrixMeta>
  | MetaKeys<typeof ledMeta>
  | MetaKeys<typeof muxMeta>
  | MetaKeys<typeof notMeta>
  | MetaKeys<typeof orMeta>
  | MetaKeys<typeof outputMeta>
  | MetaKeys<typeof ramMeta>
  | MetaKeys<typeof rngMeta>
  | MetaKeys<typeof romMeta>
  | MetaKeys<typeof segmentDisplayMeta>
  | MetaKeys<typeof srFfMeta>
  | MetaKeys<typeof switchMeta>
  | MetaKeys<typeof textMeta>
  | MetaKeys<typeof tunnelMeta>
  | MetaKeys<typeof xorMeta>;

/** Resolves to `T`, but only accepts a `T` the translation schema knows. */
type AssertTranslationKeys<T extends TranslationKey> = T;

/** Errors here when a meta names a string the translation schema lacks. */
export type BuiltInTranslationKeysAreValid =
  AssertTranslationKeys<BuiltInTranslationKeys>;
