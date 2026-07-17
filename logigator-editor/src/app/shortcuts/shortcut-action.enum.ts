export enum ShortcutActionEnum {
  SAVE = 'save',
  OPEN = 'open',
  NEW_COMPONENT = 'newComponent',

  UNDO = 'undo',
  REDO = 'redo',
  COPY = 'copy',
  CUT = 'cut',
  PASTE = 'paste',
  DELETE = 'delete',
  // Handled by the WorkModeRouter (like CANCEL): an active session's floating
  // content turns in place, otherwise the committed selection rotates.
  ROTATE_SELECTION = 'rotateSelection',
  ROTATE_SELECTION_CCW = 'rotateSelectionCcw',

  ZOOM_IN = 'zoomIn',
  ZOOM_OUT = 'zoomOut',
  ZOOM_100 = 'zoom100',

  TOOL_PAN = 'toolPan',
  TOOL_WIRE = 'toolWire',
  TOOL_SELECT = 'toolSelect',
  // Hold-style binding: scissors wires at the marquee edge while a select
  // drag is in progress (checked via ShortcutService.isHeld, not on()).
  SELECT_SCISSOR = 'selectScissor',
  TOOL_ERASE = 'toolErase',
  TOOL_PLACE_TEXT = 'toolPlaceText',

  TOGGLE_SIMULATION = 'toggleSimulation',
  CANCEL = 'cancel'
}

export const ALL_SHORTCUT_ACTIONS: readonly ShortcutActionEnum[] =
  Object.values(ShortcutActionEnum);
