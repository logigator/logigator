import type { MockedObject } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Point } from 'pixi.js';
import { MoveComponentsAction } from './move-components.action';
import type { Project } from '../../project/project';

describe('MoveComponentsAction', () => {
  let project: MockedObject<Project>;

  beforeEach(() => {
    project = {
      moveComponent: vi.fn().mockName('Project.moveComponent')
    } as unknown as MockedObject<Project>;
  });

  describe('do()', () => {
    it('calls moveComponent with (id, newPos) for a single entry', () => {
      const newPos = new Point(5, 10);
      const action = new MoveComponentsAction({
        id: 1,
        oldPos: new Point(0, 0),
        newPos
      });

      action.do(project);

      expect(project.moveComponent).toHaveBeenCalledTimes(1);

      expect(project.moveComponent).toHaveBeenCalledWith(1, newPos);
    });

    it('calls moveComponent once per entry for multiple entries', () => {
      const action = new MoveComponentsAction(
        { id: 1, oldPos: new Point(0, 0), newPos: new Point(3, 4) },
        { id: 2, oldPos: new Point(1, 1), newPos: new Point(7, 8) },
        { id: 3, oldPos: new Point(2, 2), newPos: new Point(9, 0) }
      );

      action.do(project);

      expect(project.moveComponent).toHaveBeenCalledTimes(3);
      expect(project.moveComponent).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ x: 3, y: 4 })
      );
      expect(project.moveComponent).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ x: 7, y: 8 })
      );
      expect(project.moveComponent).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ x: 9, y: 0 })
      );
    });

    it('does not call moveComponent when there are no entries', () => {
      const action = new MoveComponentsAction();

      expect(() => action.do(project)).not.toThrow();
      expect(project.moveComponent).not.toHaveBeenCalled();
    });
  });

  describe('undo()', () => {
    it('calls moveComponent with (id, oldPos) for a single entry', () => {
      const oldPos = new Point(0, 0);
      const action = new MoveComponentsAction({
        id: 1,
        oldPos,
        newPos: new Point(5, 10)
      });

      action.undo(project);

      expect(project.moveComponent).toHaveBeenCalledTimes(1);

      expect(project.moveComponent).toHaveBeenCalledWith(1, oldPos);
    });

    it('calls moveComponent once per entry for multiple entries', () => {
      const action = new MoveComponentsAction(
        { id: 1, oldPos: new Point(0, 0), newPos: new Point(3, 4) },
        { id: 2, oldPos: new Point(1, 1), newPos: new Point(7, 8) }
      );

      action.undo(project);

      expect(project.moveComponent).toHaveBeenCalledTimes(2);
      expect(project.moveComponent).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ x: 0, y: 0 })
      );
      expect(project.moveComponent).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ x: 1, y: 1 })
      );
    });

    it('does not call moveComponent when there are no entries', () => {
      const action = new MoveComponentsAction();

      expect(() => action.undo(project)).not.toThrow();
      expect(project.moveComponent).not.toHaveBeenCalled();
    });
  });

  describe('constructor position cloning', () => {
    it('clones oldPos so mutating the original does not affect stored entry', () => {
      const oldPos = new Point(1, 2);
      const action = new MoveComponentsAction({
        id: 1,
        oldPos,
        newPos: new Point(5, 6)
      });

      oldPos.set(99, 99);
      action.undo(project);

      expect(project.moveComponent).toHaveBeenCalledTimes(1);

      expect(project.moveComponent).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ x: 1, y: 2 })
      );
    });

    it('clones newPos so mutating the original does not affect stored entry', () => {
      const newPos = new Point(5, 6);
      const action = new MoveComponentsAction({
        id: 1,
        oldPos: new Point(1, 2),
        newPos
      });

      newPos.set(99, 99);
      action.do(project);

      expect(project.moveComponent).toHaveBeenCalledTimes(1);

      expect(project.moveComponent).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ x: 5, y: 6 })
      );
    });
  });
});
