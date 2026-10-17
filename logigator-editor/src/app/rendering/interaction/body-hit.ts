import { Point, Rectangle } from 'pixi.js';
import { Component } from '../../components/component';
import { isUserInput, UserInput } from '../../components/user-input';
import { Project } from '../../project/project';

/** The components whose body contains the grid point. */
export function componentBodiesAt(
  project: Project,
  gridPoint: Point
): Component[] {
  const queryRect = new Rectangle(gridPoint.x - 0.5, gridPoint.y - 0.5, 1, 1);
  return project
    .queryComponentsInRange(queryRect)
    .filter((component) =>
      component.bodyGridBounds.contains(gridPoint.x, gridPoint.y)
    );
}

/**
 * Whether a pointer on a canvas operates the component directly: a user input
 * with a single slot that declares no inspection. A press on a body can only
 * address one slot, so a multi-slot input is operated through its inspection,
 * and one that declares an inspection is played in it.
 */
export function isCanvasOperatedInput(
  component: Component
): component is Component & UserInput {
  return (
    isUserInput(component) &&
    component.inputSlots === 1 &&
    !component.config.inspection
  );
}

/**
 * The `hold` user input a press at the grid point holds, if one's body is
 * under it — preferred over any other body there, since a press on it never
 * pans. Only one operated on the canvas counts ({@link isCanvasOperatedInput}).
 */
export function holdInputAt(
  project: Project,
  gridPoint: Point
): (Component & UserInput) | null {
  return (
    componentBodiesAt(project, gridPoint).find(
      (component): component is Component & UserInput =>
        isCanvasOperatedInput(component) && component.gesture === 'hold'
    ) ?? null
  );
}
