import { describe, expect, it } from 'vitest';
import { deriveCircuitSummary } from './derive-circuit-summary';
import { BuiltInComponentType } from '../model/component-type.enum';
import type {
  SerializedCircuitBody,
  SerializedComponentBody
} from '../model/serialized-circuit';

function plug(
  type: BuiltInComponentType,
  options: Record<string, unknown>
): SerializedComponentBody {
  return { type, pos: [0, 0], options };
}

function body(...components: SerializedComponentBody[]): SerializedCircuitBody {
  return { components, wires: [] };
}

describe('deriveCircuitSummary', () => {
  const IN = BuiltInComponentType.INPUT;
  const OUT = BuiltInComponentType.OUTPUT;

  it('counts the plugs and lists every input label before every output', () => {
    expect(
      deriveCircuitSummary(
        body(
          plug(OUT, { index: 1, label: 'Q̅' }),
          plug(IN, { index: 0, label: 'A' }),
          plug(OUT, { index: 0, label: 'Q' }),
          plug(IN, { index: 1, label: 'B' })
        )
      )
    ).toEqual({ numInputs: 2, numOutputs: 2, labels: ['A', 'B', 'Q', 'Q̅'] });
  });

  it('orders each group by its index option, not by document order', () => {
    expect(
      deriveCircuitSummary(
        body(
          plug(IN, { index: 2, label: 'third' }),
          plug(IN, { index: 0, label: 'first' }),
          plug(IN, { index: 1, label: 'second' })
        )
      ).labels
    ).toEqual(['first', 'second', 'third']);
  });

  it('keeps document order for plugs sharing an index', () => {
    // Gappy and duplicate indices never come out of the Ports panel, so this is
    // externally authored data — it still has to produce one definite order.
    expect(
      deriveCircuitSummary(
        body(
          plug(IN, { index: 7, label: 'late' }),
          plug(IN, { index: 7, label: 'later' }),
          plug(IN, { index: 7, label: 'latest' })
        )
      ).labels
    ).toEqual(['late', 'later', 'latest']);
  });

  it('reads a missing or wrong-typed index as the front of its group', () => {
    expect(
      deriveCircuitSummary(
        body(
          plug(IN, { index: 1, label: 'indexed' }),
          plug(IN, { label: 'absent' }),
          plug(IN, { index: 'nonsense', label: 'wrong type' })
        )
      ).labels
    ).toEqual(['absent', 'wrong type', 'indexed']);
  });

  it('reads a missing or wrong-typed label as unlabelled', () => {
    expect(
      deriveCircuitSummary(body(plug(IN, {}), plug(IN, { label: 7 })))
    ).toEqual({ numInputs: 2, numOutputs: 0, labels: ['', ''] });
  });

  it('ignores everything that is not a plug', () => {
    expect(
      deriveCircuitSummary(
        body(
          plug(BuiltInComponentType.AND, {}),
          plug(BuiltInComponentType.TUNNEL, { label: 'not a port' }),
          plug(IN, { index: 0, label: 'A' })
        )
      )
    ).toEqual({ numInputs: 1, numOutputs: 0, labels: ['A'] });
  });

  it('answers zero ports for a circuit with no plugs', () => {
    expect(deriveCircuitSummary(body())).toEqual({
      numInputs: 0,
      numOutputs: 0,
      labels: []
    });
  });
});
