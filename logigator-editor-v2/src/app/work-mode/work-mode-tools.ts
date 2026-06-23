import { WorkMode } from './work-mode.enum';
import { WorkModeService } from './work-mode.service';
import { BuiltInComponentType } from '../components/component-type.enum';
import { ShortcutActionEnum } from '../shortcuts/shortcut-action.enum';

/** Stable identifier for a work-mode tool, independent of its WorkMode. */
export type WorkModeToolId =
  | 'pan'
  | 'wire'
  | 'connect'
  | 'select'
  | 'scissor'
  | 'erase'
  | 'text'
  | 'negate';

export interface WorkModeToolDescriptor {
  /** Stable id so surfaces can group/select tools (e.g. HUD primary row). */
  id: WorkModeToolId;
  /** Phosphor icon class, e.g. 'ph ph-hand'. */
  icon: string;
  /** i18n key under `toolBar.*` for the label / tooltip. */
  labelKey: string;
  /** Shortcut action, for the keybinding hint in tooltips. */
  shortcut: ShortcutActionEnum;
  /** Reads signals — call inside a template binding for the active state. */
  isActive: () => boolean;
  /** Switches the editor into this tool's mode. */
  activate: () => void;
}

/**
 * The editing tool set shared by the desktop tool bar and the mobile tool HUD,
 * so the two surfaces can never drift. `isActive`/`activate` stay functions:
 * the TEXT tool is COMPONENT_PLACEMENT + a selected type (active only when both
 * match), not a plain `setMode`, so a `{ mode }`-only descriptor would break it.
 */
export function createWorkModeTools(
  workMode: WorkModeService
): WorkModeToolDescriptor[] {
  const mode = workMode.mode;
  const type = workMode.selectedComponentType;
  return [
    {
      id: 'pan',
      icon: 'ph ph-hand',
      labelKey: 'toolBar.pan',
      shortcut: ShortcutActionEnum.TOOL_PAN,
      isActive: () => mode() === WorkMode.PAN,
      activate: () => workMode.setMode(WorkMode.PAN)
    },
    {
      id: 'wire',
      icon: 'ph ph-line-segment',
      labelKey: 'toolBar.placeWires',
      shortcut: ShortcutActionEnum.TOOL_WIRE_DRAWING,
      isActive: () => mode() === WorkMode.WIRE_DRAWING,
      activate: () => workMode.setMode(WorkMode.WIRE_DRAWING)
    },
    {
      id: 'connect',
      icon: 'ph ph-prohibit',
      labelKey: 'toolBar.connWires',
      shortcut: ShortcutActionEnum.TOOL_WIRE_CONNECTION,
      isActive: () => mode() === WorkMode.WIRE_CONNECTION,
      activate: () => workMode.setMode(WorkMode.WIRE_CONNECTION)
    },
    {
      id: 'select',
      icon: 'ph ph-selection',
      labelKey: 'toolBar.select',
      shortcut: ShortcutActionEnum.TOOL_SELECT,
      isActive: () => mode() === WorkMode.SELECT,
      activate: () => workMode.setMode(WorkMode.SELECT)
    },
    {
      id: 'scissor',
      icon: 'ph ph-selection-slash',
      labelKey: 'toolBar.selExact',
      shortcut: ShortcutActionEnum.TOOL_SELECT_EXACT,
      isActive: () => mode() === WorkMode.SELECT_EXACT,
      activate: () => workMode.setMode(WorkMode.SELECT_EXACT)
    },
    {
      id: 'erase',
      icon: 'ph ph-eraser',
      labelKey: 'toolBar.eraser',
      shortcut: ShortcutActionEnum.TOOL_ERASE,
      isActive: () => mode() === WorkMode.ERASE,
      activate: () => workMode.setMode(WorkMode.ERASE)
    },
    {
      id: 'text',
      icon: 'ph ph-text-t',
      labelKey: 'toolBar.text',
      shortcut: ShortcutActionEnum.TOOL_PLACE_TEXT,
      isActive: () =>
        mode() === WorkMode.COMPONENT_PLACEMENT &&
        type() === BuiltInComponentType.TEXT,
      activate: () => {
        workMode.setMode(WorkMode.COMPONENT_PLACEMENT);
        workMode.setSelectedComponentType(BuiltInComponentType.TEXT);
      }
    },
    {
      id: 'negate',
      icon: 'ph ph-circle-half-tilt',
      labelKey: 'toolBar.negate',
      shortcut: ShortcutActionEnum.TOOL_PORT_NEGATION,
      isActive: () => mode() === WorkMode.PORT_NEGATION,
      activate: () => workMode.setMode(WorkMode.PORT_NEGATION)
    }
  ];
}
