import { Component } from '../components/component';
import { ComponentInspection } from '../components/component-inspection';

/** One live inspection: the inspected instance and its inspection model. */
export interface OpenInspection {
  readonly component: Component;
  readonly inspection: ComponentInspection;
}

/**
 * Hosts inspection views in one presentation style — a floating window per
 * inspection on desktop, the shared bottom sheet on compact. Presenters only
 * own the framing: {@link InspectionService} owns the inspections' lifecycle
 * and is told through `dismissed` when the user closes a view from the
 * presenter's own chrome (window ✕, sheet swipe-down, Escape).
 */
export interface InspectionPresenter {
  /** Present the inspection; `dismissed` reports a user-driven close. */
  show(entry: OpenInspection, dismissed: () => void): void;
  /** Bring the entry's view to the user's attention (raise / select tab). */
  focus(entry: OpenInspection): void;
  /** Remove the entry's view without touching the inspection itself. */
  close(entry: OpenInspection): void;
}
