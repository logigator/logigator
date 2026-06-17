/**
 * Master gate for negation reaching the simulation engine.
 *
 * Negation is always rendered, persisted, and editable. What this gates is the
 * two paths that hand negation to the simulator: descriptor emission in
 * `BoardCompilerService` and the bubble's gate-side power tint during a run.
 * Both stay off until a negation-capable `@logigator/sim` engine ships, so the
 * editor never feeds the current (negation-blind) engine fields it may reject
 * and never shows a sim tint the engine doesn't actually honour.
 *
 * Flip to `true` in the same change that bumps the `@logigator/sim` dependency
 * to a negation-capable version (see the negation-indicators plan §6d).
 */
export const NEGATION_SIM_ENABLED = false;
