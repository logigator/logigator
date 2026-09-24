import { BuiltInComponentType, CUSTOM_TYPE_ID_BASE } from '@logigator/core';

/**
 * Types whose ports carry a signal the simulation never sees: a plug is a
 * boundary the flattener binds through, a tunnel is a net join. Inverting
 * either would mean an inverter unit in the graph, and a tick of delay with
 * it.
 */
const NON_NEGATABLE_TYPES: ReadonlySet<number> = new Set([
  BuiltInComponentType.INPUT,
  BuiltInComponentType.OUTPUT,
  BuiltInComponentType.TUNNEL
]);

/**
 * Whether a bubble may be *added* to a port of this type. A placed custom
 * instance's external ports are not independently negatable — the bubbles are
 * the definition's own — and the transparent types above take none either.
 *
 * Clearing a bubble is always allowed, whichever path put it there, so nothing
 * an older board carries is stranded. The wire tool and the automation API
 * both read this, so an agent is held to what a tap can do.
 */
export function acceptsPortNegation(type: number): boolean {
  return type < CUSTOM_TYPE_ID_BASE && !NON_NEGATABLE_TYPES.has(type);
}
