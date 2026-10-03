import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';

/** Structural view of a circuit: a live Project or an instantiated body. */
export interface CircuitElements {
  components: Iterable<Component>;
  wires: Iterable<Wire>;
}

export interface NetPortRef {
  component: Component;
  /**
   * Index in the component's `connectionPoints` order: `< numInputs` ⇒ input
   * pin, else output pin `portIndex - numInputs`.
   */
  portIndex: number;
}

/**
 * One electrical node: every wire and component port whose termination points
 * are transitively connected.
 */
export interface Net {
  wires: Wire[];
  ports: NetPortRef[];
}

/**
 * Union-find over dense integer node ids, with path compression. Doubles as the
 * board compiler's node arena: template instantiation allocates fresh nodes and
 * unions plug-bound nets into outer nets.
 */
export class UnionFind {
  private readonly _parent: number[] = [];

  public makeSet(): number {
    const node = this._parent.length;
    this._parent.push(node);
    return node;
  }

  public find(node: number): number {
    let root = node;
    while (this._parent[root] !== root) {
      this._parent[root] = this._parent[this._parent[root]];
      root = this._parent[root];
    }
    return root;
  }

  public union(a: number, b: number): void {
    this._parent[this.find(a)] = this.find(b);
  }
}

/**
 * Derives the electrical nets of a circuit from geometry. The wire-integration
 * invariants guarantee connections occur only where terminations coincide at a
 * half-grid point, so extraction is a union-find over `"x,y"` termination
 * points: each wire unions its two endpoints, each component port joins
 * whatever class its point lands in, and a component never unions its own
 * ports. A net is one class — a dangling port yields a singleton.
 */
export function extractNets(circuit: CircuitElements): Net[] {
  const uf = new UnionFind();
  const nodes = new Map<string, number>();
  const nodeAt = (x: number, y: number): number => {
    const key = `${x},${y}`;
    let node = nodes.get(key);
    if (node === undefined) {
      node = uf.makeSet();
      nodes.set(key, node);
    }
    return node;
  };

  const wireNodes: [Wire, number][] = [];
  for (const wire of circuit.wires) {
    const [start, end] = wire.connectionPoints;
    const node = nodeAt(start.x, start.y);
    uf.union(node, nodeAt(end.x, end.y));
    wireNodes.push([wire, node]);
  }

  const portNodes: [NetPortRef, number][] = [];
  for (const component of circuit.components) {
    component.connectionPoints.forEach((point, portIndex) => {
      portNodes.push([{ component, portIndex }, nodeAt(point.x, point.y)]);
    });
  }

  const nets: Net[] = [];
  const netOfClass = new Map<number, Net>();
  const netFor = (node: number): Net => {
    const root = uf.find(node);
    let net = netOfClass.get(root);
    if (!net) {
      net = { wires: [], ports: [] };
      netOfClass.set(root, net);
      nets.push(net);
    }
    return net;
  };
  for (const [wire, node] of wireNodes) {
    netFor(node).wires.push(wire);
  }
  for (const [port, node] of portNodes) {
    netFor(node).ports.push(port);
  }
  return nets;
}
