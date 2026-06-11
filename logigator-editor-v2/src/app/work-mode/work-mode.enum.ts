export const enum WorkMode {
  WIRE_DRAWING = 'drawWire',
  WIRE_CONNECTION = 'connWire',
  SELECT = 'sel',
  SELECT_EXACT = 'selExact',
  ERASE = 'erase',
  COMPONENT_PLACEMENT = 'placeComp',
  // Running/inspecting a simulation: editing is locked, buttons/levers are
  // clickable, pan/zoom keep working.
  SIMULATION = 'simulation'
}
