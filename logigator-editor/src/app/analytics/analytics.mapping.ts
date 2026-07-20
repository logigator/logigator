import { SerializedAction } from '../actions/serialized-action.model';

/**
 * Product-analytics event names. Centralised so the taxonomy is auditable in
 * one place and callers can't drift into ad-hoc event strings.
 */
export const AnalyticsEvent = {
  ToolSelected: 'tool_selected',
  EditorOperation: 'editor_operation',
  SimulationStarted: 'simulation_started',
  SimulationStopped: 'simulation_stopped',
  SimulationCompileBlocked: 'simulation_compile_blocked',
  ProjectSaved: 'project_saved',
  ProjectLoaded: 'project_loaded',
  ProjectImported: 'project_imported',
  ProjectExported: 'project_exported',
  ProjectUploaded: 'project_uploaded',
  CustomComponentCreated: 'custom_component_created',
  ShareLinkGenerated: 'share_link_generated',
  TutorialStarted: 'tutorial_started',
  TutorialStepCompleted: 'tutorial_step_completed',
  TutorialCompleted: 'tutorial_completed',
  TutorialAbandoned: 'tutorial_abandoned',
  DocPageOpened: 'doc_page_opened'
} as const;

const MAX_STRING_LENGTH = 64;

/**
 * Enforces the "properties are structural/categorical only" rule as
 * defense-in-depth: keeps primitives (and flat arrays of them), truncates long
 * strings, and drops everything else (nested objects, functions) so a careless
 * caller can't leak user-authored content — component labels, tunnel names, ROM
 * blobs, option values — into analytics. The discipline still lives at the call
 * sites; this is the backstop.
 */
export function sanitizeProperties(
  properties: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    const clean = sanitizeValue(value);
    if (clean !== undefined) sanitized[key] = clean;
  }
  return sanitized;
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string')
    return value.length > MAX_STRING_LENGTH
      ? value.slice(0, MAX_STRING_LENGTH)
      : value;
  if (Array.isArray(value))
    return value.map(sanitizeValue).filter((v) => v !== undefined);
  return undefined;
}

/**
 * Maps a committed action's serialized form to the categorical properties for
 * the `editor_operation` event: operation kind, element counts, placed
 * component type ids, the changed option's key, and negation side/flag. Never
 * the values themselves, element ids, or labels.
 */
export function operationProperties(
  action: SerializedAction
): Record<string, unknown> {
  switch (action.type) {
    case 'addComponents':
      return {
        operation: action.type,
        count: action.components.length,
        componentTypes: action.components.map((c) => c.type)
      };
    case 'removeComponents':
      return { operation: action.type, count: action.components.length };
    case 'addWires':
    case 'removeWires':
      return { operation: action.type, count: action.wires.length };
    case 'moveComponents':
    case 'moveWires':
    case 'rotateComponents':
    case 'rotateWires':
      return { operation: action.type, count: action.entries.length };
    case 'changeOption':
      return { operation: action.type, optionKey: action.optionKey };
    case 'togglePortNegation':
      return {
        operation: action.type,
        side: action.side,
        negated: action.negated
      };
    case 'container':
      return { operation: action.type, count: action.actions.length };
  }
}
