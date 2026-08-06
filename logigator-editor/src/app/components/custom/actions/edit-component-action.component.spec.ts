import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { EditComponentActionComponent } from './edit-component-action.component';
import { ComponentActionContext } from '../../component-action';
import { CustomComponentRegistry } from '../custom-component-registry.service';
import { UserService } from '../../../user/user.service';
import { ProjectMetadataStore } from '../../../persistence/project-metadata.store';
import { Project } from '../../../project/project';
import { configureTestBed } from '../../../../testing/configure-test-bed';

type Mode = 'edit' | 'view' | 'restore' | 'signIn' | null;

describe('EditComponentActionComponent', () => {
  let registry: CustomComponentRegistry;
  let userService: { user: () => unknown };
  let metadataStore: ProjectMetadataStore;
  // The document the selected instance sits in; the settings panel passes the
  // active project, so its source is what decides the degraded mode.
  let host: Project;
  const hosts: Project[] = [];

  // The visible affordance is driven by the protected `mode` signal; assert it
  // directly rather than through the rendered template.
  function mode(type: number): Mode {
    const fixture = TestBed.createComponent(EditComponentActionComponent);
    fixture.componentRef.setInput('context', {
      config: { type },
      component: { config: { type } },
      project: host
    } as unknown as ComponentActionContext);
    fixture.detectChanges();
    return (
      fixture.componentInstance as unknown as { mode: () => Mode }
    ).mode();
  }

  function ingestOrphan(origin: 'server' | 'browser'): number {
    const remap = registry.ingestSnapshots([
      {
        type: 1000,
        source: { id: 'lost', version: 1, origin },
        name: 'N',
        symbol: 'S',
        description: '',
        numInputs: 0,
        numOutputs: 0,
        labels: [],
        components: [],
        wires: []
      }
    ]);
    return remap.get(1000)!;
  }

  function makeHost(source: 'server' | 'browser' | 'share'): void {
    host = new Project();
    hosts.push(host);
    metadataStore.register(host, {
      id: 'host',
      name: 'Host',
      type: 'project',
      source,
      hash: '',
      isPublic: false
    });
  }

  beforeEach(() => {
    userService = { user: () => null };
    configureTestBed(
      [{ provide: UserService, useValue: userService }],
      [EditComponentActionComponent]
    );
    registry = TestBed.inject(CustomComponentRegistry);
    metadataStore = TestBed.inject(ProjectMetadataStore);
    makeHost('browser');
  });

  afterEach(() => {
    for (const project of hosts.splice(0)) project.destroy();
  });

  it('shows nothing for a built-in', () => {
    expect(mode(1)).toBeNull();
  });

  it('edits a resolvable master', () => {
    const master = registry.createMaster({ id: 'm', symbol: 'S' }, 'browser');
    expect(mode(master)).toBe('edit');
  });

  it('restores a lost local master', () => {
    expect(mode(ingestOrphan('browser'))).toBe('restore');
  });

  it('prompts sign-in for a lost cloud master while signed out', () => {
    expect(mode(ingestOrphan('server'))).toBe('signIn');
  });

  it('restores a lost cloud master while signed in', () => {
    userService.user = () => ({ id: 'u' });
    expect(mode(ingestOrphan('server'))).toBe('restore');
  });

  it('views an orphan inside a share instead of restoring it', () => {
    makeHost('share');
    // Both signed-out and signed-in viewers: a share's masters are somebody
    // else's, so neither sign-in nor a library restore is the right offer.
    expect(mode(ingestOrphan('server'))).toBe('view');
    expect(mode(ingestOrphan('browser'))).toBe('view');
    userService.user = () => ({ id: 'u' });
    expect(mode(ingestOrphan('server'))).toBe('view');
  });

  it('still edits a resolvable master inside a share', () => {
    makeHost('share');
    const master = registry.createMaster({ id: 'm2', symbol: 'S' }, 'browser');
    expect(mode(master)).toBe('edit');
  });
});
