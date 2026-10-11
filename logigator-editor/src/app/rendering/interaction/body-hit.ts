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
 * The `hold` user input a press at the grid point holds, if one's body is
 * under it — preferred over any other body there, since a press on it never
 * pans. Only one operated on the canvas counts: an input that declares an
 * inspection is played in it, and a tap opens that instead.
 */
export function holdInputAt(
  project: Project,
  gridPoint: Point
): (Component & UserInput) | null {
  return (
    componentBodiesAt(project, gridPoint).find(
      (component): component is Component & UserInput =>
        isUserInput(component) &&
        component.gesture === 'hold' &&
        !component.config.inspection
    ) ?? null
  );
}
