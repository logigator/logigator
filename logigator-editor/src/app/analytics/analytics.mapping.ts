import { SerializedAction } from '../actions/serialized-action.model';

/**
 * Product-analytics event names. Centralised so the taxonomy is auditable and
 * callers can't drift into ad-hoc event strings.
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
  CustomComponentDeleted: 'custom_component_deleted',
  SettingChanged: 'setting_changed',
  DialogOpened: 'dialog_opened',
  DialogClosed: 'dialog_closed',
  ErrorShown: 'error_shown',
  BugReportSubmitted: 'bug_report_submitted',
  WireRepairOffered: 'wire_repair_offered',
  WireRepairRun: 'wire_repair_run',
  ChangelogViewed: 'changelog_viewed',
  LegacyEditorOpened: 'legacy_editor_opened',
  BrowserUnsupported: 'browser_unsupported',
  InspectionOpened: 'inspection_opened',
  ShareLinkGenerated: 'share_link_generated',
  TutorialStarted: 'tutorial_started',
  TutorialStepCompleted: 'tutorial_step_completed',
  TutorialCompleted: 'tutorial_completed',
  TutorialAbandoned: 'tutorial_abandoned',
  DocPageOpened: 'doc_page_opened'
} as const;

/**
 * Identifies each dialog to the `dialog_opened` / `dialog_closed` pair, passed
 * to the library as `DialogConfig.telemetryId`. One id per surface, not per
 * entry point; the share dialog splits by what is shared, the axis worth
 * breaking down by.
 *
 * The pair measures reach and abandonment, not task completion:
 * `dialog_closed.resolved` only says the dialog closed with a result, and
 * several dialogs commit through their own API or have no result to give. The
 * outcome events (`share_link_generated`, `project_saved`, …) are the
 * completion signal.
 */
export const DialogId = {
  About: 'about',
  BugReportError: 'bug-report-error',
  BugReportManual: 'bug-report-manual',
  Changelog: 'changelog',
  CloseTab: 'close-tab',
  ComponentDetails: 'component-details',
  Documentation: 'documentation',
  ExportImage: 'export-image',
  Logout: 'logout',
  NewComponent: 'new-component',
  OpenProject: 'open-project',
  RomDataEditor: 'rom-data-editor',
  SaveProject: 'save-project',
  ShareComponent: 'share-component',
  ShareProject: 'share-project',
  ShareProjectFromList: 'share-project-from-list',
  ShortcutManager: 'shortcut-manager',
  Upload: 'upload'
} as const;

export type DialogId = (typeof DialogId)[keyof typeof DialogId];

const MAX_STRING_LENGTH = 256;

/**
 * Backstop for the "properties are structural/categorical only" rule: keeps
 * primitives and flat arrays of them, truncates long strings, drops everything
 * else, so user-authored content (labels, tunnel names, ROM blobs, option
 * values) cannot leak into analytics. The discipline lives at the call sites.
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
 * `editor_operation`: operation kind, counts, component type ids, the changed
 * option's key, negation side/flag. Never values, element ids, or labels.
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
