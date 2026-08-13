/**
 * The newest native circuit-file format version, and the single source of truth
 * for both sides of the wire: the editor writes exactly this version, and the
 * API normalizes every incoming document to it before storing (so the database
 * only ever holds one version).
 *
 * Bumping it is a coordinated change: add a `CircuitFileV<N>` interface and a
 * migration to the chain, re-point `CurrentCircuitFile`, and deploy the editor
 * together with the API plus its bulk re-normalization job (documents whose
 * stored `format_version` is lower are migrated and their derived metadata
 * re-extracted). Documents claiming a version *newer* than this are rejected
 * rather than stored — never store what cannot be parsed.
 */
export const CURRENT_FILE_VERSION = 1;
