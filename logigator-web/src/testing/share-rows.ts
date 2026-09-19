import type { ShareResponse } from '@logigator/contract';
import type { CircuitFileV1 } from '@logigator/core';

type ProjectShare = Extract<ShareResponse, { kind: 'project' }>;
type ComponentShare = Extract<ShareResponse, { kind: 'component' }>;

/**
 * The document a share carries. The landing page draws the summary beside it
 * rather than the circuit itself, so this is the least the contract accepts —
 * and it is still the key the schema wants, so a fixture without one is a read
 * the boundary rejects.
 */
const emptyCircuit = (name: string): CircuitFileV1 => ({
  version: 1,
  name,
  components: [],
  wires: '',
  definitions: []
});

const AUTHOR = {
  id: '33333333-3333-4333-8333-333333333333',
  username: 'marek_h',
  avatar: null
} as const;

/**
 * One shared document, as `GET /api/share/:link` answers it. The link is the
 * caller's, because it is the address rather than a field of the document; the
 * ids and the dates are well-formed for the reason the community rows are — the
 * contract checks them, and a response it rejects is a read that failed.
 */
export function shareProjectResponse(
  link: string,
  patch: Partial<ProjectShare> = {}
): ProjectShare {
  return {
    kind: 'project',
    project: {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Half adder',
      description: 'Two gates and an XOR.',
      public: true,
      link,
      version: 1,
      componentCount: 9,
      wireCount: 7,
      preview: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      lastEditedAt: '2026-01-02T00:00:00.000Z'
    },
    document: emptyCircuit('Half adder'),
    dependencies: [],
    attribution: [],
    author: AUTHOR,
    stars: 12,
    ...patch
  };
}

/**
 * The same from the other table. A component carries its port surface on the
 * summary, and the boundary rejects a response without it — so a spec that
 * reuses the project shape for a component share tests a failed read.
 */
export function shareComponentResponse(
  link: string,
  patch: Partial<ComponentShare> = {}
): ComponentShare {
  return {
    kind: 'component',
    component: {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Half adder',
      description: '',
      public: true,
      link,
      version: 1,
      componentCount: 9,
      wireCount: 7,
      preview: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      lastEditedAt: '2026-01-02T00:00:00.000Z',
      symbol: 'HA',
      numInputs: 2,
      numOutputs: 2,
      labels: ['A', 'B', 'S', 'C']
    },
    document: emptyCircuit('Half adder'),
    dependencies: [],
    attribution: [],
    author: AUTHOR,
    stars: 12,
    ...patch
  };
}
