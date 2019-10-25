import { Element } from '../element';

export type PowerChangesIn = Map<number, boolean>;
export type PowerChangesOutWire = Map<Element, boolean>;
export type PowerChangesOutWireEnd = Map<{component: Element, wireEndIndex: number}, boolean>;
