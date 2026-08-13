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
