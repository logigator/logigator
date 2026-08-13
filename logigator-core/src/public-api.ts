/**
 * Public surface of `@logigator/core`.
 *
 * The package is consumed buildless through the workspace tsconfig `paths`
 * mapping (like `@logigator/ui`): the editor's and the API's bundlers compile
 * this source directly. It stays free of runtime dependencies and of any
 * framework or renderer import — enforced by `eslint.config.mjs` and by a
 * standalone `tsc --noEmit` over the package alone.
 *
 * Boundary rule: core is data to data. Turning live editor objects into
 * documents (and back) stays in the editor.
 */

// ---- model: the shapes documents are made of ----
export {
  BuiltInComponentType,
  CUSTOM_TYPE_ID_BASE
} from './model/component-type.enum';
export type {
  ComponentType,
  CustomComponentType
} from './model/component-type.enum';
export { ComponentCategory } from './model/component-category.enum';
export { Direction } from './model/direction';
export { WireDirection } from './model/wire-direction.enum';
export type { ProjectElement } from './model/project-element';
export type {
  DependencyMapping,
  DependencySnapshot,
  EmbeddedDependency
} from './model/dependencies';
export type {
  CustomComponentDefinition,
  CustomComponentDetails,
  CustomComponentSummaryPatch
} from './model/custom-component-definition.model';
export {
  cloneCircuit,
  cloneComponentBody,
  remapComponentTypes
} from './model/serialized-circuit';
export type {
  SerializedCircuitBody,
  SerializedComponentBody,
  SerializedWireBody,
  SnapshotDefinition
} from './model/serialized-circuit';
export type {
  PersistedCircuitV0,
  PersistedCircuitV1,
  PersistedComponentV0,
  PersistedComponentV1,
  PersistedSnapshotDefinitionV1,
  PersistedWiresV1
} from './model/persisted-circuit.types';
export {
  CUSTOM_BODY_GRID_WIDTH,
  legacyAnchorToPivot,
  legacyBodyHeight,
  legacyBodyWidth,
  legacyCustomBodySize,
  pivotToLegacyAnchor
} from './model/legacy-anchor';

// ---- catalog: what each built-in type is, as pure data ----
export {
  bitWeightLabels,
  busLabels,
  defaultBodyHeight,
  indexLabels,
  NO_LABELS,
  NO_PORTS,
  widenMeta
} from './catalog/component-meta';
export type {
  BodySize,
  ComponentMeta,
  LegacyV0Slots,
  PortLabels,
  Ports
} from './catalog/component-meta';
export { defaultOptionValues } from './catalog/option-schema';
export type {
  MemoryOptionSchema,
  NumberOptionSchema,
  OptionSchema,
  OptionValues,
  SelectButtonOptionSchema,
  SelectDropdownOptionSchema,
  SelectOptionValue,
  TextAreaOptionSchema,
  TextOptionSchema
} from './catalog/option-schema';
export { validateOptionValue } from './catalog/validate-option-value';
export { BUILT_IN_META, builtInMeta } from './catalog/built-in-meta';
export { andMeta } from './catalog/built-ins/and.meta';
export { buttonMeta } from './catalog/built-ins/button.meta';
export { clockMeta } from './catalog/built-ins/clock.meta';
export { dFfMeta } from './catalog/built-ins/d-ff.meta';
export { decoderMeta } from './catalog/built-ins/decoder.meta';
export { delayMeta } from './catalog/built-ins/delay.meta';
export { demuxMeta } from './catalog/built-ins/demux.meta';
export { encoderMeta } from './catalog/built-ins/encoder.meta';
export { fullAdderMeta } from './catalog/built-ins/full-adder.meta';
export { halfAdderMeta } from './catalog/built-ins/half-adder.meta';
export { inputMeta } from './catalog/built-ins/input.meta';
export { jkFfMeta } from './catalog/built-ins/jk-ff.meta';
export { ledMeta } from './catalog/built-ins/led.meta';
export { ledMatrixMeta } from './catalog/built-ins/led-matrix.meta';
export { muxMeta } from './catalog/built-ins/mux.meta';
export { notMeta } from './catalog/built-ins/not.meta';
export { orMeta } from './catalog/built-ins/or.meta';
export { outputMeta } from './catalog/built-ins/output.meta';
export { ramMeta } from './catalog/built-ins/ram.meta';
export { rngMeta } from './catalog/built-ins/rng.meta';
export { romMeta } from './catalog/built-ins/rom.meta';
export { segmentDisplayMeta } from './catalog/built-ins/segment-display.meta';
export { srFfMeta } from './catalog/built-ins/sr-ff.meta';
export { switchMeta } from './catalog/built-ins/switch.meta';
export { textMeta } from './catalog/built-ins/text.meta';
export { tunnelMeta } from './catalog/built-ins/tunnel.meta';
export { xorMeta } from './catalog/built-ins/xor.meta';
export {
  ledMatrixShape,
  type LedMatrixSize
} from './catalog/built-ins/led-matrix.meta';
export {
  SegmentBase,
  segmentReadoutDigits
} from './catalog/built-ins/segment-display.meta';

// ---- codecs: the compact encodings the v1 document uses ----
export {
  encodeWireChain,
  decodeWireChain,
  WireChainDecodeError
} from './codecs/wire-chain.codec';
export type { EncodedWireChain } from './codecs/wire-chain.codec';
export {
  encodeComponentPositions,
  decodeComponentPositions,
  PositionDeltaDecodeError
} from './codecs/position-delta.codec';
export type { EncodedComponentPositions } from './codecs/position-delta.codec';
export {
  toPersistedDefinition,
  fromPersistedDefinition
} from './codecs/persisted-definition.codec';

// ---- format: the versioned file envelope, its validator and its container ----
export { CURRENT_FILE_VERSION } from './format/circuit-file-version';
export type {
  CircuitFileV0,
  CircuitFileV1,
  CurrentCircuitFile,
  FileForkAttributionV1,
  LegacyComponentDefinition
} from './format/circuit-file.types';
export {
  InvalidFileError,
  UnsupportedVersionError
} from './format/circuit-file.errors';
export { validateCurrentCircuitFile } from './format/circuit-file-validator';
export {
  LGIX_CONTAINER_VERSION,
  decodeLgix,
  encodeLgix,
  hasLgixMagic
} from './format/lgix-container';
