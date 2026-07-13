import { WorkMode } from './work-mode.enum';
import { WorkModeService } from './work-mode.service';
import { BuiltInComponentType } from '../components/component-type.enum';
import { ShortcutActionEnum } from '../shortcuts/shortcut-action.enum';

/** Stable identifier for a work-mode tool, independent of its WorkMode. */
export type WorkModeToolId = 'pan' | 'wire' | 'select' | 'erase' | 'text';

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
      labelKey: 'toolBar.wireTool',
      shortcut: ShortcutActionEnum.TOOL_WIRE,
      isActive: () => mode() === WorkMode.WIRE_TOOL,
      activate: () => workMode.setMode(WorkMode.WIRE_TOOL)
    },
    {
      // The select tool covers both marquee flavors; the scissor variant is a
      // sub-state driven by the toggle below or the held SELECT_SCISSOR key.
      id: 'select',
      icon: 'ph ph-selection',
      labelKey: 'toolBar.select',
      shortcut: ShortcutActionEnum.TOOL_SELECT,
      isActive: () =>
        mode() === WorkMode.SELECT || mode() === WorkMode.SELECT_EXACT,
      activate: () => workMode.setMode(WorkMode.SELECT)
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
    }
  ];
}

/**
 * The scissor sub-toggle of the select tool: switches the marquee between
 * plain SELECT and SELECT_EXACT (cut wires at the marquee edge). Rendered by
 * `ScissorToggleComponent` as a floating pill over the canvas while the select
 * tool is active — on touch it is the only way to scissor; on desktop it
 * doubles as a discoverable hint for the hold-to-scissor key (SELECT_SCISSOR,
 * Alt by default).
 */
export interface ScissorToggleDescriptor {
  icon: string;
  /** Full description — tooltip / aria label. */
  labelKey: string;
  /** Short label shown inside the floating pill. */
  shortLabelKey: string;
  shortcut: ShortcutActionEnum;
  /** Visible only while the select tool is active. */
  isVisible: () => boolean;
  isActive: () => boolean;
  toggle: () => void;
}

export function createScissorToggle(
  workMode: WorkModeService
): ScissorToggleDescriptor {
  const mode = workMode.mode;
  return {
    icon: 'ph ph-selection-slash',
    labelKey: 'toolBar.selExact',
    shortLabelKey: 'toolBar.selExactShort',
    shortcut: ShortcutActionEnum.SELECT_SCISSOR,
    isVisible: () =>
      mode() === WorkMode.SELECT || mode() === WorkMode.SELECT_EXACT,
    isActive: () => mode() === WorkMode.SELECT_EXACT,
    toggle: () =>
      workMode.setMode(
        mode() === WorkMode.SELECT_EXACT
          ? WorkMode.SELECT
          : WorkMode.SELECT_EXACT
      )
  };
}
