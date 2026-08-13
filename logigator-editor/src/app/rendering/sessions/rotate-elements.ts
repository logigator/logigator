import { PointData, Rectangle } from 'pixi.js';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { WireDirection } from '@logigator/core';
import {
  normalizeRotationSteps,
  rotateDirection,
  rotatePointAroundPivot
} from '../../utils/rotation';

/**
 * Group rotation over live element instances — shared by the sessions whose
 * floating content can turn (selection move, paste placement).
 */

/** Tight AABB over the elements' `gridBounds`, or null for an empty group. */
export function groupGridBounds(
  components: readonly Component[],
  wires: readonly Wire[]
): Rectangle | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const fold = (b: Rectangle): void => {
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.right > maxX) maxX = b.right;
    if (b.bottom > maxY) maxY = b.bottom;
  };
  for (const c of components) fold(c.gridBounds);
  for (const w of wires) fold(w.gridBounds);
  if (!Number.isFinite(minX)) return null;
  return new Rectangle(minX, minY, maxX - minX, maxY - minY);
}

/**
 * Rotates the elements clockwise around `pivot` by `steps` quarter-turns,
 * in place.
 *
 * Components anchor by their rotation pivot, so orbiting `position` while
 * stepping `direction` turns every port exactly: the new port set is the old
 * one rotated around the pivot, preserving all relative geometry. The
 * direction setter's own fixed-body-anchor shift is irrelevant here because
 * the orbit target overwrites the position afterwards.
 *
 * A wire turns by orbiting both endpoints and swapping its axis on odd steps;
 * its length is rotation-invariant.
 */
export function rotateElements(
  components: readonly Component[],
  wires: readonly Wire[],
  pivot: PointData,
  steps: number
): void {
  const s = normalizeRotationSteps(steps);
  if (s === 0) return;

  for (const c of components) {
    const target = rotatePointAroundPivot(pivot, c.position, s);
    c.direction = rotateDirection(c.direction, s);
    c.position.copyFrom(target);
  }

  for (const w of wires) {
    const [start, end] = w.connectionPoints;
    const a = rotatePointAroundPivot(pivot, start, s);
    const b = rotatePointAroundPivot(pivot, end, s);
    if (s % 2 === 1) {
      w.direction =
        w.direction === WireDirection.HORIZONTAL
          ? WireDirection.VERTICAL
          : WireDirection.HORIZONTAL;
    }
    // The rotated start may land past the rotated end; a wire's position is
    // always its lesser endpoint, so re-normalize.
    w.position.set(Math.min(a.x, b.x), Math.min(a.y, b.y));
  }
}
