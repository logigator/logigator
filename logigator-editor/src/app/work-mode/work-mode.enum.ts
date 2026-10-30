export const enum WorkMode {
  // Hand tool: one pointer pans the board, and nothing else.
  PAN = 'pan',
  // The wire tool: drag draws wires; a tap toggles a port's negation bubble
  // or, off-port, the wire connection at the nearest half-grid point.
  WIRE_TOOL = 'wireTool',
  // The select tool, the editor's default as in design tools: a click
  // selects, a drag on the selection moves it, elsewhere draws a marquee.
  SELECT = 'sel',
  // The select tool's scissor sub-state: wires are cut at the marquee edge on
  // commit.
  SELECT_EXACT = 'selExact',
  ERASE = 'erase',
  COMPONENT_PLACEMENT = 'placeComp',
  // Running/inspecting a simulation: editing is locked, buttons/switches are
  // clickable, pan/zoom keep working.
  SIMULATION = 'simulation'
}

/** The mode the editor starts in and falls back to (Escape, the end of a
 *  simulation, a placement whose type went away). */
export const DEFAULT_WORK_MODE = WorkMode.SELECT;
