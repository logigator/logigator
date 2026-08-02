import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import {
  FakeBrowserComponentStore,
  FakeBrowserProjectStore
} from '../../testing/fake-browser-stores';
import { setStaticDIInjector } from '../utils/get-di';
import { CustomComponent } from '../components/custom/custom-component';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { ComponentProviderService } from '../components/component-provider.service';
import { CustomComponentService } from '../custom-component/custom-component.service';
import { BrowserComponentStore } from '../persistence/browser/browser-component.store';
import { BrowserProjectStore } from '../persistence/browser/browser-project.store';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { Project } from '../project/project';
import { ProjectService } from '../project/project.service';
import { WorkModeService } from '../work-mode/work-mode.service';
import { AutomationApiService } from './automation-api.service';

describe('AutomationApiService documents', () => {
  let api: AutomationApiService;
  let customComponents: CustomComponentService;
  let projectService: ProjectService;
  let metadataStore: ProjectMetadataStore;
  let registry: CustomComponentRegistry;
  let provider: ComponentProviderService;
  let main: Project;

  beforeEach(() => {
    configureTestBed([
      {
        provide: BrowserComponentStore,
        useValue: new FakeBrowserComponentStore()
      },
      { provide: BrowserProjectStore, useValue: new FakeBrowserProjectStore() }
    ]);
    setStaticDIInjector(TestBed.inject(Injector));
    api = TestBed.inject(AutomationApiService);
    customComponents = TestBed.inject(CustomComponentService);
    projectService = TestBed.inject(ProjectService);
    metadataStore = TestBed.inject(ProjectMetadataStore);
    registry = TestBed.inject(CustomComponentRegistry);
    provider = TestBed.inject(ComponentProviderService);

    main = new Project();
    metadataStore.register(main, {
      id: 'main',
      name: 'Main',
      type: 'project',
      source: 'browser',
      hash: '',
      isPublic: false
    });
    projectService.setMainProject(main);
  });

  /** A library master with an open editor tab, as "new component" creates it. */
  function createMaster(name: string, symbol: string): Promise<Project> {
    return customComponents.createComponent({
      name,
      symbol,
      description: '',
      source: 'browser'
    });
  }

  function masterTypeIdOf(editor: Project): number {
    return registry.masterTypeIdForId(metadataStore.getMetadata(editor)!.id)!;
  }

  describe('tabs', () => {
    it('lists the pinned main project first, then the open components', async () => {
      const editor = await createMaster('Half Adder', 'HA');

      expect(api.tabList()).toEqual([
        {
          index: 0,
          name: 'Main',
          documentType: 'project',
          id: 'main',
          active: false,
          dirty: false
        },
        {
          index: 1,
          name: 'Half Adder',
          documentType: 'comp',
          id: metadataStore.getMetadata(editor)!.id,
          active: true,
          dirty: expect.any(Boolean)
        }
      ]);
    });

    it('activates a tab, switching what every other call targets', async () => {
      await createMaster('X', 'X');

      const tab = api.tabActivate(0);

      expect(tab.active).toBe(true);
      expect(projectService.activeProject()).toBe(main);
      expect(api.getProject().name).toBe('Main');
    });

    it('closes a clean component tab', async () => {
      const editor = await createMaster('X', 'X');

      api.tabClose(1);

      expect(projectService.openComponents()).not.toContain(editor);
      expect(projectService.activeProject()).toBe(main);
    });

    it('refuses to close a dirty tab without discardChanges', async () => {
      const editor = await createMaster('X', 'X');
      metadataStore.markDirty(editor);

      expect(() => api.tabClose(1)).toThrow(/unsaved changes/);
      expect(projectService.openComponents()).toContain(editor);

      api.tabClose(1, { discardChanges: true });
      expect(projectService.openComponents()).not.toContain(editor);
    });

    it('refuses to close the main project and unknown tabs', async () => {
      expect(() => api.tabClose(0)).toThrow(/main project/);
      expect(() => api.tabActivate(7)).toThrow(/no tab at index 7/);
    });

    it('refuses tab switching while the circuit is simulating', async () => {
      await createMaster('X', 'X');
      TestBed.inject(WorkModeService).setSimulationMode(true);

      expect(() => api.tabActivate(0)).toThrow(/simulation/);
      expect(() => api.tabClose(1)).toThrow(/simulation/);
    });
  });

  describe('library', () => {
    it('lists the masters, not the frozen copies placed from them', async () => {
      const editor = await createMaster('Half Adder', 'HA');
      const masterTypeId = masterTypeIdOf(editor);
      // Placing takes a snapshot: a second definition, of the same component,
      // that the library must not list.
      const snapshot = registry.snapshot(masterTypeId);
      main.addComponent(
        provider.getComponent(snapshot.typeId)!.create({}) as CustomComponent
      );

      expect(api.libraryList()).toEqual([
        {
          type: masterTypeId,
          id: metadataStore.getMetadata(editor)!.id,
          name: 'Half Adder',
          symbol: 'HA',
          source: 'browser',
          open: true
        }
      ]);
    });

    it('edit opens a master in its own tab, from a placed instance’s type', async () => {
      const editor = await createMaster('Half Adder', 'HA');
      const masterTypeId = masterTypeIdOf(editor);
      const snapshotTypeId = registry.snapshot(masterTypeId).typeId;
      api.tabActivate(0);
      api.tabClose(1);

      // The snapshot's type id is what a placed instance carries — it resolves
      // back to the master through its provenance.
      const tab = await api.libraryEdit(snapshotTypeId);

      expect(tab).toMatchObject({ name: 'Half Adder', active: true });
      expect(projectService.activeProject()).not.toBe(main);
      expect(api.libraryList()[0].open).toBe(true);
    });

    it('edit focuses an already-open editor rather than opening a second', async () => {
      const editor = await createMaster('Half Adder', 'HA');
      api.tabActivate(0);

      const tab = await api.libraryEdit(masterTypeIdOf(editor));

      expect(projectService.activeProject()).toBe(editor);
      expect(tab.index).toBe(1);
      expect(api.tabList()).toHaveLength(2);
    });

    it('refuses when the open failed, even from another component’s tab', async () => {
      const editor = await createMaster('Half Adder', 'HA');
      const other = await createMaster('Decoder', 'DEC');
      // A failed open reports itself through a toast and returns, leaving
      // whatever tab was active alone — here another *component's*, so "some
      // component tab is active" would read the failure as success.
      vi.spyOn(customComponents, 'openComponentForEdit').mockResolvedValue();

      await expect(api.libraryEdit(masterTypeIdOf(editor))).rejects.toThrow(
        /could not be opened/
      );
      expect(projectService.activeProject()).toBe(other);
    });

    it('refuses a type that is not a custom component', async () => {
      await expect(api.libraryEdit(2)).rejects.toThrow(/no custom component/);
    });
  });
});
