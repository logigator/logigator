/**
 * The newest native document format version, and the single source of truth for
 * every side: clients write exactly this version and the API normalizes every
 * incoming document to it, so storage only ever holds one version.
 *
 * Bumping it is a coordinated change: add a `CircuitFileV<N>` interface and a
 * migration, re-point `CurrentCircuitFile`, and deploy the clients with the API
 * and its re-normalization job. A document claiming a newer version is rejected
 * rather than stored.
 */
export const CURRENT_FILE_VERSION = 1;
