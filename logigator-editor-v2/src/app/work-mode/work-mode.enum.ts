export const enum WorkMode {
  WIRE_DRAWING = 'drawWire',
  WIRE_CONNECTION = 'connWire',
  SELECT = 'sel',
  SELECT_EXACT = 'selExact',
  ERASE = 'erase',
  COMPONENT_PLACEMENT = 'placeComp',
  // Click a component port to toggle its inverter (negation) bubble.
  PORT_NEGATION = 'negPort',
  // Running/inspecting a simulation: editing is locked, buttons/levers are
  // clickable, pan/zoom keep working.
  SIMULATION = 'simulation'
}
