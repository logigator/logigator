import { beforeEach, describe, expect, it } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Point } from 'pixi.js';
import { BuiltInComponentType, WireDirection } from '@logigator/core';
import { setStaticDIInjector } from '../utils/get-di';
import { ActionContainer } from './action-container';
import { AddComponentsAction } from './actions/add-components.action';
import { RemoveWiresAction } from './actions/remove-wires.action';
import { MoveComponentsAction } from './actions/move-components.action';
import type { SerializedComponent } from '../components/serialized-component.model';
import type { SerializedWire } from '../wires/serialized-wire.model';
import type { MoveEntry } from './actions/move-entry.model';
import type { SerializedAction } from './serialized-action.model';
import { makeAction } from '../../testing/action-mocks';

/** Narrows a serialized action to one variant, so a spec can read its payload. */
function payload<T extends SerializedAction['type']>(
  dto: SerializedAction,
  type: T
): Extract<SerializedAction, { type: T }> {
  expect(dto.type).toBe(type);
  return dto as Extract<SerializedAction, { type: T }>;
}

/**
 * Above V8's `new F(...arr)` argument ceiling, measured at 62,302 in Chrome —
 * the limit that made pasting a large board throw `RangeError`. Every action
 * below takes its elements as one array for that reason, so this is the size
 * the constructors have to carry without a spread call in between.
 */
const OVER_SPREAD_LIMIT = 100_000;

function serializedComponents(count: number): SerializedComponent[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    type: BuiltInComponentType.AND,
    pos: [i % 512, Math.floor(i / 512)] as [number, number],
    options: {}
  }));
}

function serializedWires(count: number): SerializedWire[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    pos: [i % 512, Math.floor(i / 512)] as [number, number],
    direction: WireDirection.HORIZONTAL,
    length: 2
  }));
}

function moveEntries(count: number): MoveEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    oldPos: new Point(i % 512, Math.floor(i / 512)),
    newPos: new Point((i % 512) + 4, Math.floor(i / 512))
  }));
}

describe('actions over a selection larger than a spread call can carry', () => {
  beforeEach(() => {
    setStaticDIInjector(TestBed.inject(Injector));
  });

  it('AddComponentsAction keeps every component of a large paste', () => {
    const components = serializedComponents(OVER_SPREAD_LIMIT);

    const action = new AddComponentsAction(components);

    expect(
      payload(action.serialize(), 'addComponents').components
    ).toHaveLength(OVER_SPREAD_LIMIT);
  });

  it('RemoveWiresAction keeps every wire of a large delete', () => {
    const wires = serializedWires(OVER_SPREAD_LIMIT);

    const action = new RemoveWiresAction(wires);

    expect(payload(action.serialize(), 'removeWires').wires).toHaveLength(
      OVER_SPREAD_LIMIT
    );
  });

  it('MoveComponentsAction keeps every entry of a large move', () => {
    const entries = moveEntries(OVER_SPREAD_LIMIT);

    const action = new MoveComponentsAction(entries);

    expect(payload(action.serialize(), 'moveComponents').entries).toHaveLength(
      OVER_SPREAD_LIMIT
    );
  });

  it('ActionContainer groups more actions than a spread call can pass', () => {
    const actions = Array.from({ length: OVER_SPREAD_LIMIT }, () =>
      makeAction()
    );

    const container = new ActionContainer(actions);

    expect(container.length).toBe(OVER_SPREAD_LIMIT);
  });

  it('does not alias the array it was handed', () => {
    const components = serializedComponents(3);

    const action = new AddComponentsAction(components);
    components.length = 0;

    expect(
      payload(action.serialize(), 'addComponents').components
    ).toHaveLength(3);
  });
});
