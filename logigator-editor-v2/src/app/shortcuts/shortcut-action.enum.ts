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

  ZOOM_IN = 'zoomIn',
  ZOOM_OUT = 'zoomOut',
  ZOOM_100 = 'zoom100',

  TOOL_WIRE_DRAWING = 'toolWireDrawing',
  TOOL_WIRE_CONNECTION = 'toolWireConnection',
  TOOL_SELECT = 'toolSelect',
  TOOL_SELECT_EXACT = 'toolSelectExact',
  TOOL_ERASE = 'toolErase',
  TOOL_COMPONENT_PLACEMENT = 'toolComponentPlacement',
  TOOL_PLACE_TEXT = 'toolPlaceText',

  CANCEL = 'cancel'
}

export const ALL_SHORTCUT_ACTIONS: readonly ShortcutActionEnum[] =
  Object.values(ShortcutActionEnum);
