export const enum WorkMode {
  // Hand tool: one pointer pans the board. The navigate-first default on every
  // device — a fresh board moves on first drag rather than mutating.
  PAN = 'pan',
  // The wire tool: drag draws wires; a tap toggles a port's negation bubble
  // or, off-port, the wire connection at the nearest half-grid point.
  WIRE_TOOL = 'wireTool',
  SELECT = 'sel',
  // The select tool's scissor sub-state (marquee toggle or held
  // SELECT_SCISSOR key): wires are cut at the marquee edge on commit.
  SELECT_EXACT = 'selExact',
  ERASE = 'erase',
  COMPONENT_PLACEMENT = 'placeComp',
  // Running/inspecting a simulation: editing is locked, buttons/switches are
  // clickable, pan/zoom keep working.
  SIMULATION = 'simulation'
}
