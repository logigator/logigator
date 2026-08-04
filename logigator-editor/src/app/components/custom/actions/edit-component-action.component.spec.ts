import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { EditComponentActionComponent } from './edit-component-action.component';
import { ComponentActionContext } from '../../component-action';
import { CustomComponentRegistry } from '../custom-component-registry.service';
import { UserService } from '../../../user/user.service';
import { configureTestBed } from '../../../../testing/configure-test-bed';

describe('EditComponentActionComponent', () => {
  let registry: CustomComponentRegistry;
  let userService: { user: () => unknown };

  // The visible affordance is driven by the protected `mode` signal; assert it
  // directly rather than through the rendered template.
  function mode(type: number): 'edit' | 'restore' | 'signIn' | null {
    const fixture = TestBed.createComponent(EditComponentActionComponent);
    fixture.componentRef.setInput('context', {
      config: { type },
      component: { config: { type } },
      project: {}
    } as unknown as ComponentActionContext);
    fixture.detectChanges();
    return (
      fixture.componentInstance as unknown as {
        mode: () => 'edit' | 'restore' | 'signIn' | null;
      }
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

  beforeEach(() => {
    userService = { user: () => null };
    configureTestBed(
      [{ provide: UserService, useValue: userService }],
      [EditComponentActionComponent]
    );
    registry = TestBed.inject(CustomComponentRegistry);
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
});
