import { Point, Rectangle } from 'pixi.js';
import { Component } from '../../components/component';
import { ButtonComponent } from '../../components/component-types/button/button.component';
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
 * The button a press at the grid point holds, if one's body is under it —
 * preferred over any other body there, since a press on it never pans.
 */
export function buttonAt(
  project: Project,
  gridPoint: Point
): ButtonComponent | null {
  return (
    componentBodiesAt(project, gridPoint).find(
      (component): component is ButtonComponent =>
        component instanceof ButtonComponent
    ) ?? null
  );
}
