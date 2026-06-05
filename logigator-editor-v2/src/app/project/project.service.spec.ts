import { TestBed } from '@angular/core/testing';

import { ProjectService } from './project.service';
import { Project } from './project';

describe('ProjectService', () => {
  let service: ProjectService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProjectService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('mainProject() is null initially', () => {
    expect(service.mainProject()).toBeNull();
  });

  it('openComponents() is an empty array initially', () => {
    expect(service.openComponents()).toEqual([]);
  });

  it('activeProject() is null initially', () => {
    expect(service.activeProject()).toBeNull();
  });

  describe('setMainProject', () => {
    it('sets mainProject() to the provided project', () => {
      const p = {} as Project;
      service.setMainProject(p);
      expect(service.mainProject()).toBe(p);
    });

    it('sets activeProject() to the provided project', () => {
      const p = {} as Project;
      service.setMainProject(p);
      expect(service.activeProject()).toBe(p);
    });

    it('updates mainProject and activeProject when called a second time', () => {
      const p1 = {} as Project;
      const p2 = {} as Project;
      service.setMainProject(p1);
      service.setMainProject(p2);
      expect(service.mainProject()).toBe(p2);
      expect(service.activeProject()).toBe(p2);
    });
  });

  describe('addOpenComponent', () => {
    it('adds the project to openComponents()', () => {
      const p = {} as Project;
      service.addOpenComponent(p);
      expect(service.openComponents()).toContain(p);
    });

    it('adds both projects when called twice', () => {
      const p1 = {} as Project;
      const p2 = {} as Project;
      service.addOpenComponent(p1);
      service.addOpenComponent(p2);
      expect(service.openComponents()).toEqual([p1, p2]);
    });
  });

  describe('removeOpenComponent', () => {
    it('removes the project from openComponents()', () => {
      const p = {} as Project;
      service.addOpenComponent(p);
      service.removeOpenComponent(p);
      expect(service.openComponents()).not.toContain(p);
    });

    it('resets activeProject to mainProject when the active component is removed', () => {
      const comp = {} as Project;
      // setMainProject sets both mainProject and activeProject to comp
      service.setMainProject(comp);
      service.addOpenComponent(comp);
      service.removeOpenComponent(comp);
      // After removal of the active project, activeProject falls back to mainProject
      expect(service.activeProject()).toBe(service.mainProject());
    });

    it('does NOT change activeProject when a non-active component is removed', () => {
      const main = {} as Project;
      const comp1 = {} as Project;
      const comp2 = {} as Project;
      service.setMainProject(main);
      service.addOpenComponent(comp1);
      service.addOpenComponent(comp2);
      // activeProject is still main
      service.removeOpenComponent(comp1);
      expect(service.activeProject()).toBe(main);
    });

    it('is a no-op when the project is not in openComponents', () => {
      const p = {} as Project;
      expect(() => service.removeOpenComponent(p)).not.toThrow();
      expect(service.openComponents()).toEqual([]);
    });
  });
});
