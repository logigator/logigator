export type CompileDiagnosticKind =
  /** A component type the simulator has no implementation for (e.g. ROM). */
  | 'unsupported'
  /** A custom definition without an inlined snapshot circuit. */
  | 'missing-circuit'
  /** A custom definition that (transitively) places itself. */
  | 'recursive-definition'
  /** A definition's plug components do not match its declared port summary. */
  | 'plug-mismatch';

/**
 * One blocking compile failure. Any diagnostic prevents entering simulation —
 * a board missing components would be semantically wrong, so nothing is
 * silently skipped.
 */
export interface CompileDiagnostic {
  kind: CompileDiagnosticKind;
  /**
   * Path of custom-instance component ids (joined by `/`) from the top level
   * down to the circuit containing the offender; `''` = top level.
   */
  instancePath: string;
  /** Type id of the offending component or definition. */
  componentType: number;
  /** The offending component's id within its circuit, when applicable. */
  componentId?: number;
  /** Human-readable summary, surfaced when entering simulation is refused. */
  message: string;
}
