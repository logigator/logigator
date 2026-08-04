import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { makeAnd } from '../../../testing/factories';
import { Component } from '../../components/component';
import { ComponentProviderService } from '../../components/component-provider.service';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { BuiltInComponentType } from '../../components/component-type.enum';
import { Project } from '../../project/project';
import { BoardCompilerService } from './board-compiler.service';

// The compiler emits negation into the descriptor verbatim; the negation-capable
// @logigator/sim engine consumes the index arrays.
describe('BoardCompilerService negation emission', () => {
  let compiler: BoardCompilerService;
  let registry: CustomComponentRegistry;
  let provider: ComponentProviderService;
  let project: Project;

  beforeEach(() => {
    configureTestBed();
    compiler = TestBed.inject(BoardCompilerService);
    registry = TestBed.inject(CustomComponentRegistry);
    provider = TestBed.inject(ComponentProviderService);
    project = new Project();
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  function andUnit() {
    return compiler
      .compile(project)
      .descriptor.components.find((c) => c.type === BuiltInComponentType.AND)!;
  }

  it('emits sorted within-group index arrays for a negated unit', () => {
    const and = makeAnd(3, undefined, 0, 0); // inputs 0,1,2; output 0
    and.setPortNegated('in', 2, true);
    and.setPortNegated('in', 0, true);
    and.setPortNegated('out', 0, true);
    project.addComponent(and);

    const unit = andUnit();
    expect(unit.negInputs).toEqual([0, 2]);
    expect(unit.negOutputs).toEqual([0]);
  });

  it('omits negation arrays for an un-negated unit', () => {
    project.addComponent(makeAnd(2, undefined, 0, 0));

    const unit = andUnit();
    expect('negInputs' in unit).toBe(false);
    expect('negOutputs' in unit).toBe(false);
  });

  it('handles a negated index beyond a 32-bit word on a wide AND', () => {
    const and = makeAnd(40, undefined, 0, 0);
    and.setPortNegated('in', 39, true);
    project.addComponent(and);

    expect(andUnit().negInputs).toEqual([39]);
  });

  it('ignores out-of-range negated indices left by a port-count shrink', () => {
    const and = makeAnd(5, undefined, 0, 0);
    and.setPortNegated('in', 4, true);
    and.numInputs = 2; // index 4 stays in the set but is now out of range
    project.addComponent(and);

    expect('negInputs' in andUnit()).toBe(false);
  });

  it('propagates negation of a built-in flattened out of a custom component', () => {
    // A custom whose circuit is a single AND with input 1 negated; no plugs
    // (0/0 declared) so it compiles cleanly with the AND's pins dangling.
    const master = registry.createMaster(
      {
        id: 'id-neg',
        symbol: 'N',
        numInputs: 0,
        numOutputs: 0,
        labels: [],
        circuit: {
          components: [
            {
              type: BuiltInComponentType.AND,
              pos: [0, 0],
              options: { numInputs: 2 },
              negInputs: [1]
            }
          ],
          wires: []
        }
      },
      'browser'
    );
    const typeId = registry.snapshot(master).typeId;
    project.addComponent(
      Component.deserialize(
        { pos: [0, 0], options: {} },
        provider.getComponent(typeId)!
      )
    );

    // The flattened descriptor carries the inner AND's negation unchanged.
    expect(andUnit().negInputs).toEqual([1]);
  });
});
