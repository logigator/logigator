import { computed, Signal } from '@angular/core';
import { Component } from '../components/component';
import {
  ComponentInspection,
  InspectionTitlePart
} from '../components/component-inspection';

/** One live inspection: the inspected instance and its inspection model. */
export interface OpenInspection {
  readonly component: Component;
  readonly inspection: ComponentInspection;
  /**
   * Where the component lives when it is a watch's copy rather than a board
   * component: the names of the watch levels down to the one holding it,
   * outermost first. Absent on the board.
   */
  readonly place?: readonly string[];
}

/** Separates the segments of a flat title, as the window's breadcrumb does. */
const TITLE_SEPARATOR = ' › ';

/**
 * The entry's flat title: its place, then the inspection's own title. On the
 * board it is the inspection's title itself.
 */
export function entryTitle(entry: OpenInspection): Signal<string> {
  const { inspection, place } = entry;
  if (!place?.length) {
    return inspection.title;
  }
  return computed(() => [...place, inspection.title()].join(TITLE_SEPARATOR));
}

/**
 * The entry's title segments: its place as plain segments, then the
 * inspection's own breadcrumb or title. `undefined` where the inspection's
 * own title stands alone.
 */
export function entryTitleParts(
  entry: OpenInspection
): Signal<readonly InspectionTitlePart[]> | undefined {
  const { inspection, place } = entry;
  if (!place?.length) {
    return inspection.titleParts;
  }
  return computed(() => [
    ...place.map((label) => ({ label })),
    ...(inspection.titleParts?.() ?? [{ label: inspection.title() }])
  ]);
}

/**
 * Hosts inspection views in one presentation style — a floating window per
 * inspection on desktop, the shared bottom sheet on compact. A presenter owns
 * only the framing; `dismissed` reports a close from its own chrome (window ✕,
 * sheet swipe-down, Escape) to the inspection lifecycle's owner.
 */
export interface InspectionPresenter {
  /** Present the inspection; `dismissed` reports a user-driven close. */
  show(entry: OpenInspection, dismissed: () => void): void;
  /** Bring the entry's view to the user's attention (raise / select tab). */
  focus(entry: OpenInspection): void;
  /** Remove the entry's view without touching the inspection itself. */
  close(entry: OpenInspection): void;
}
