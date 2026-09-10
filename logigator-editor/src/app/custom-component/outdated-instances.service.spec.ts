import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { OutdatedInstancesService } from './outdated-instances.service';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { ComponentProviderService } from '../components/component-provider.service';
import { ProjectService } from '../project/project.service';
import { Project } from '../project/project';
import { CustomComponent } from '../components/custom/custom-component';
import { AddComponentsAction } from '../actions/actions/add-components.action';
import { BuiltInComponentType } from '@logigator/core';
import { makeAnd } from '../../testing/factories';

describe('OutdatedInstancesService', () => {
  let service: OutdatedInstancesService;
  let registry: CustomComponentRegistry;
  let provider: ComponentProviderService;
  let projectService: ProjectService;
  let main: Project;

  beforeEach(() => {
    configureTestBed();
    service = TestBed.inject(OutdatedInstancesService);
    registry = TestBed.inject(CustomComponentRegistry);
    provider = TestBed.inject(ComponentProviderService);
    projectService = TestBed.inject(ProjectService);

    main = new Project();
    projectService.setMainProject(main);
    TestBed.tick();
  });

  function createMaster(symbol: string): number {
    return registry.createMaster(
      { symbol, numInputs: 1, numOutputs: 1, labels: ['A', 'Q'] },
      'browser'
    );
  }

  /** Snapshots the master and places an instance, as placement does. */
  function place(masterTypeId: number, target = main): CustomComponent {
    const def = registry.snapshot(masterTypeId);
    const config = provider.getComponent(def.typeId)!;
    const instance = config.create({}) as CustomComponent;
    target.addComponent(instance);
    return instance;
  }

  describe('isOutdated', () => {
    it('is false for a built-in type', () => {
      expect(service.isOutdated(BuiltInComponentType.AND)).toBe(false);
    });

    it('is false for a master type (only placed snapshots go stale)', () => {
      const master = createMaster('CC');
      expect(service.isOutdated(master)).toBe(false);
    });

    it("is false for a snapshot taken at the master's current version", () => {
      const master = createMaster('CC');
      expect(service.isOutdated(registry.snapshot(master).typeId)).toBe(false);
    });

    it("is true once the master's version moves past the snapshot's", () => {
      const master = createMaster('CC');
      const snapshot = registry.snapshot(master);

      registry.setMasterVersion(master, 2);

      expect(service.isOutdated(snapshot.typeId)).toBe(true);
    });

    it('resolves a snapshot captured before an upload-to-cloud through the promotion alias', () => {
      const master = createMaster('CC');
      // Frozen against the browser id, which promotion replaces.
      const snapshot = registry.snapshot(master);

      registry.promoteMaster(master, 'server-id', 2);

      expect(service.isOutdated(snapshot.typeId)).toBe(true);
    });

    it('is false for an orphan whose master is gone', () => {
      const master = createMaster('CC');
      const snapshot = registry.snapshot(master);
      registry.setMasterVersion(master, 2);

      registry.removeMaster(master);

      expect(service.isOutdated(snapshot.typeId)).toBe(false);
    });

    it('is false for a snapshot with no version provenance', () => {
      const master = createMaster('CC');
      registry.setMasterVersion(master, 7);
      // A master id with no version leaves nothing to compare against.
      const typeId = registry.registerSnapshot({
        kind: 'snapshot',
        source: 'browser',
        id: registry.getDefinition(master)!.id,
        name: '',
        symbol: 'CC',
        description: '',
        numInputs: 1,
        numOutputs: 1,
        labels: ['A', 'Q']
      });

      expect(service.isOutdated(typeId)).toBe(false);
    });
  });

  it('counts only instances behind their master, keyed by master type id', () => {
    const master = createMaster('CC');
    place(master);
    place(master);
    registry.setMasterVersion(master, 2);
    place(master);
    main.addComponent(makeAnd());

    expect(service.countFor(master)).toBe(2);
  });

  it('counts instances of several stale versions of one master together', () => {
    const master = createMaster('CC');
    const v1 = place(master);
    registry.setMasterVersion(master, 2);
    const v2 = place(master);
    registry.setMasterVersion(master, 3);

    expect(v1.config.type).not.toBe(v2.config.type);
    expect(service.countFor(master)).toBe(2);
    expect(service.countFor(v1.config.type)).toBe(2);
  });

  it('counts nothing for a master whose instances are all current', () => {
    const master = createMaster('CC');
    place(master);

    expect(service.countFor(master)).toBe(0);
  });

  it('recounts after a board mutation and after the master version moves', () => {
    const master = createMaster('CC');
    const stale = place(master);
    expect(service.countFor(master)).toBe(0);

    registry.setMasterVersion(master, 2);
    expect(service.countFor(master)).toBe(1);

    const config = provider.getComponent(stale.config.type)!;
    main.actionManager.push(new AddComponentsAction(config.create({})));
    expect(service.countFor(master)).toBe(2);
  });

  it('collects exactly the outdated instances of one master', () => {
    const master = createMaster('CC');
    const other = createMaster('DD');
    const stale = place(master);
    const staleOther = place(other);
    registry.setMasterVersion(master, 2);
    registry.setMasterVersion(other, 2);
    const current = place(master);

    const collected = service.collectFor(master);

    expect(collected).toEqual([stale]);
    expect(collected).not.toContain(current);
    expect(collected).not.toContain(staleOther);
  });

  it('scopes to the active project', () => {
    const master = createMaster('CC');
    const editor = new Project();
    place(master, editor);
    registry.setMasterVersion(master, 2);

    expect(service.countFor(master)).toBe(0);

    projectService.setActiveProject(editor);
    expect(service.countFor(master)).toBe(1);
    expect(service.collectFor(master)).toHaveLength(1);
  });
});
