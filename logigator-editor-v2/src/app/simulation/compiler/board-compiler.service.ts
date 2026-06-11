import { inject, Injectable } from '@angular/core';
import { Component } from '../../components/component';
import { ComponentProviderService } from '../../components/component-provider.service';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { CustomComponentDefinition } from '../../components/custom/custom-component-definition.model';
import {
  BuiltInComponentType,
  CUSTOM_TYPE_ID_BASE
} from '../../components/component-type.enum';
import { instantiateBody } from '../../persistence/circuit-builder';
import { Project } from '../../project/project';
import {
  BoardComponentDescriptor,
  CompiledBoard,
  LinkRenderTargets,
  TOP_LEVEL_PATH
} from './compiled-board.model';
import { CompileDiagnostic } from './compile-error';
import { extractNets, Net, UnionFind } from './net-extractor';

/** Component types emitted as simulator units, recognized by type id. */
const UNIT_TYPES: ReadonlySet<number> = new Set([
  BuiltInComponentType.NOT,
  BuiltInComponentType.AND,
  BuiltInComponentType.BUTTON,
  BuiltInComponentType.LEVER
]);

/** One emitted unit, pins as union-find node ids (link ids come later). */
interface EmittedUnit {
  type: number;
  inputs: number[];
  outputs: number[];
}

/**
 * A snapshot definition's circuit compiled once per session: units with
 * template-local net ids, plus the plug bindings tying local nets to the
 * instance's outer pins. Nested custom instances are already flattened into
 * `units`. Snapshots are frozen, so a cached template never invalidates.
 */
interface CompiledTemplate {
  /** Number of template-local nets referenced by units or plug bindings. */
  netCount: number;
  units: EmittedUnit[];
  /** Local net id per input pin, in plug-index order. */
  inputBindings: number[];
  /** Local net id per output pin, in plug-index order. */
  outputBindings: number[];
  /** Instance paths relative to the template's own circuit. */
  diagnostics: CompileDiagnostic[];
}

/** Mutable state of one compilation pass over a single node-id space. */
interface EmitContext {
  uf: UnionFind;
  units: EmittedUnit[];
  diagnostics: CompileDiagnostic[];
  /** Set only for the top-level circuit: button/lever id → board index. */
  userInputs?: Map<number, number>;
}

function joinPath(parent: string, child: string): string {
  if (parent === '') return child;
  if (child === '') return parent;
  return `${parent}/${child}`;
}

/** Per-component lookup: `connectionPoints` port index → net index. */
function buildPortNetLookup(nets: Net[]): Map<Component, number[]> {
  const lookup = new Map<Component, number[]>();
  nets.forEach((net, netIndex) => {
    for (const { component, portIndex } of net.ports) {
      let ports = lookup.get(component);
      if (!ports) {
        ports = [];
        lookup.set(component, ports);
      }
      ports[portIndex] = netIndex;
    }
  });
  return lookup;
}

/**
 * Compiles the active circuit into the WASM simulator's board format plus the
 * link → render-target mapping. Synchronous and registry-backed: custom
 * components expand from their inlined snapshot circuits via session-cached
 * templates; no store loading.
 */
@Injectable({
  providedIn: 'root'
})
export class BoardCompilerService {
  private readonly provider = inject(ComponentProviderService);
  private readonly registry = inject(CustomComponentRegistry);

  // Keyed by snapshot type id; snapshots are frozen, so entries never
  // invalidate for the lifetime of the session.
  private readonly _templates = new Map<number, CompiledTemplate>();
  private readonly _templatesInProgress = new Set<number>();

  public compile(project: Project): CompiledBoard {
    const ctx: EmitContext = {
      uf: new UnionFind(),
      units: [],
      diagnostics: [],
      userInputs: new Map<number, number>()
    };

    const nets = extractNets({
      components: project.components,
      wires: project.wires
    });
    const netNodes = nets.map(() => ctx.uf.makeSet());
    const portNets = buildPortNetLookup(nets);

    // Quad-tree iteration order is not guaranteed stable — sort by component
    // id so the submission order (and with it triggerInput comp ids and the
    // getOutputs layout) is reproducible.
    const components = [...project.components].sort((a, b) => a.id - b.id);
    for (const component of components) {
      const pinNodes = (portNets.get(component) ?? []).map(
        (netIndex) => netNodes[netIndex]
      );
      this._emitComponent(component, pinNodes, TOP_LEVEL_PATH, ctx);
    }

    // Dense link ids over final classes referenced by ≥1 unit pin, assigned
    // in emission order. Instantiation adds unions, so this must run only
    // after all expansion completed. Wire-only or plug-only classes get no
    // link — they stay unpowered.
    const linkOfClass = new Map<number, number>();
    const linkFor = (node: number): number => {
      const root = ctx.uf.find(node);
      let link = linkOfClass.get(root);
      if (link === undefined) {
        link = linkOfClass.size;
        linkOfClass.set(root, link);
      }
      return link;
    };
    const descriptorComponents: BoardComponentDescriptor[] = ctx.units.map(
      (unit) => ({
        type: unit.type,
        inputs: unit.inputs.map(linkFor),
        outputs: unit.outputs.map(linkFor)
      })
    );
    const links = linkOfClass.size;

    const targets: LinkRenderTargets[] = Array.from({ length: links }, () => ({
      wires: [],
      ports: []
    }));
    nets.forEach((net, netIndex) => {
      const link = linkOfClass.get(ctx.uf.find(netNodes[netIndex]));
      if (link === undefined) return;
      targets[link].wires.push(...net.wires);
      targets[link].ports.push(...net.ports);
    });

    return {
      descriptor: { links, components: descriptorComponents },
      mapping: new Map([[TOP_LEVEL_PATH, targets]]),
      userInputs: ctx.userInputs!,
      diagnostics: ctx.diagnostics
    };
  }

  /**
   * Emits one component into the current node-id space: units directly,
   * custom instances by template instantiation. `pinNodes` are the nodes of
   * the nets at the component's ports, in `connectionPoints` order.
   */
  private _emitComponent(
    component: Component,
    pinNodes: number[],
    path: string,
    ctx: EmitContext
  ): void {
    const type = component.config.type;

    if (type >= CUSTOM_TYPE_ID_BASE) {
      const template = this._templateFor(type, path, component.id, ctx);
      if (template) {
        this._instantiateTemplate(
          template,
          pinNodes,
          joinPath(path, String(component.id)),
          ctx
        );
      }
      return;
    }

    if (UNIT_TYPES.has(type)) {
      if (
        ctx.userInputs &&
        (type === BuiltInComponentType.BUTTON ||
          type === BuiltInComponentType.LEVER)
      ) {
        ctx.userInputs.set(component.id, ctx.units.length);
      }
      ctx.units.push({
        type,
        inputs: pinNodes.slice(0, component.numInputs),
        outputs: pinNodes.slice(component.numInputs)
      });
      return;
    }

    // TEXT has no ports; top-level INPUT/OUTPUT plugs are inert decoration
    // (no board unit), but their nets are still mapped so their stubs light
    // up. Inside a template, plugs are collected before emission and never
    // reach this point.
    if (
      type === BuiltInComponentType.TEXT ||
      type === BuiltInComponentType.INPUT ||
      type === BuiltInComponentType.OUTPUT
    ) {
      return;
    }

    ctx.diagnostics.push({
      kind: 'unsupported',
      instancePath: path,
      componentType: type,
      componentId: component.id,
      message: `Component "${component.config.symbol}" is not supported by the simulator`
    });
  }

  /**
   * Materializes a placed instance: a fresh global node per template-local
   * net, each plug-bound local net unioned with the outer net at the matching
   * instance pin. A plug wired straight to another plug thereby merges the
   * two outer nets through the instance.
   */
  private _instantiateTemplate(
    template: CompiledTemplate,
    pinNodes: number[],
    path: string,
    ctx: EmitContext
  ): void {
    const localNodes = Array.from({ length: template.netCount }, () =>
      ctx.uf.makeSet()
    );
    // Pin counts can disagree with the bindings when the template carries a
    // plug-mismatch diagnostic; the board is rejected anyway, so bind what
    // aligns instead of failing hard.
    template.inputBindings.forEach((local, pin) => {
      if (pin < pinNodes.length) ctx.uf.union(localNodes[local], pinNodes[pin]);
    });
    template.outputBindings.forEach((local, pin) => {
      const outerPin = template.inputBindings.length + pin;
      if (outerPin < pinNodes.length) {
        ctx.uf.union(localNodes[local], pinNodes[outerPin]);
      }
    });

    for (const unit of template.units) {
      ctx.units.push({
        type: unit.type,
        inputs: unit.inputs.map((node) => localNodes[node]),
        outputs: unit.outputs.map((node) => localNodes[node])
      });
    }
    for (const diagnostic of template.diagnostics) {
      ctx.diagnostics.push({
        ...diagnostic,
        instancePath: joinPath(path, diagnostic.instancePath)
      });
    }
  }

  private _templateFor(
    snapshotTypeId: number,
    path: string,
    instanceId: number,
    ctx: EmitContext
  ): CompiledTemplate | null {
    const cached = this._templates.get(snapshotTypeId);
    if (cached) return cached;

    const def = this.registry.getDefinition(snapshotTypeId);
    if (this._templatesInProgress.has(snapshotTypeId)) {
      ctx.diagnostics.push({
        kind: 'recursive-definition',
        instancePath: path,
        componentType: snapshotTypeId,
        componentId: instanceId,
        message: `Custom component "${def?.name ?? snapshotTypeId}" recursively places itself`
      });
      return null;
    }
    if (!def?.circuit) {
      ctx.diagnostics.push({
        kind: 'missing-circuit',
        instancePath: path,
        componentType: snapshotTypeId,
        componentId: instanceId,
        message: `Custom component "${def?.name ?? snapshotTypeId}" has no circuit to simulate`
      });
      return null;
    }

    this._templatesInProgress.add(snapshotTypeId);
    try {
      const template = this._buildTemplate(def);
      this._templates.set(snapshotTypeId, template);
      return template;
    } finally {
      this._templatesInProgress.delete(snapshotTypeId);
    }
  }

  /**
   * Compiles one snapshot circuit into a template. The body is instantiated
   * into live elements (for real port geometry, rotation included), net
   * extracted, and destroyed again — it is never added to a Project.
   */
  private _buildTemplate(def: CustomComponentDefinition): CompiledTemplate {
    const { components, wires } = instantiateBody(this.provider, def.circuit!);
    try {
      const ctx: EmitContext = {
        uf: new UnionFind(),
        units: [],
        diagnostics: []
      };
      const nets = extractNets({ components, wires });
      const netNodes = nets.map(() => ctx.uf.makeSet());
      const portNets = buildPortNetLookup(nets);
      const nodesOf = (component: Component): number[] =>
        (portNets.get(component) ?? []).map((netIndex) => netNodes[netIndex]);

      const inputPlugs: { component: Component; index: number }[] = [];
      const outputPlugs: { component: Component; index: number }[] = [];

      const sorted = [...components].sort((a, b) => a.id - b.id);
      for (const component of sorted) {
        const type = component.config.type;
        if (
          type === BuiltInComponentType.INPUT ||
          type === BuiltInComponentType.OUTPUT
        ) {
          const plug = {
            component,
            index: component.options['index'].value as number
          };
          (type === BuiltInComponentType.INPUT ? inputPlugs : outputPlugs).push(
            plug
          );
          continue;
        }
        this._emitComponent(component, nodesOf(component), '', ctx);
      }

      const byIndex = (
        a: { component: Component; index: number },
        b: { component: Component; index: number }
      ) => a.index - b.index || a.component.id - b.component.id;
      inputPlugs.sort(byIndex);
      outputPlugs.sort(byIndex);

      if (
        inputPlugs.length !== def.numInputs ||
        outputPlugs.length !== def.numOutputs
      ) {
        ctx.diagnostics.push({
          kind: 'plug-mismatch',
          instancePath: '',
          componentType: def.typeId,
          message:
            `Custom component "${def.name}" declares ` +
            `${def.numInputs}/${def.numOutputs} ports but its circuit has ` +
            `${inputPlugs.length}/${outputPlugs.length} plugs`
        });
      }

      // A plug's single port is its only connection point (portIndex 0).
      const inputBindingNodes = inputPlugs.map(
        (plug) => nodesOf(plug.component)[0]
      );
      const outputBindingNodes = outputPlugs.map(
        (plug) => nodesOf(plug.component)[0]
      );

      // Compress to canonical template-local net ids. Only classes referenced
      // by a unit pin or a plug binding survive — inner wire-only nets are
      // irrelevant until nested inspection materializes inner mappings.
      const canonical = new Map<number, number>();
      const localId = (node: number): number => {
        const root = ctx.uf.find(node);
        let id = canonical.get(root);
        if (id === undefined) {
          id = canonical.size;
          canonical.set(root, id);
        }
        return id;
      };
      const units = ctx.units.map((unit) => ({
        type: unit.type,
        inputs: unit.inputs.map(localId),
        outputs: unit.outputs.map(localId)
      }));
      const inputBindings = inputBindingNodes.map(localId);
      const outputBindings = outputBindingNodes.map(localId);

      return {
        netCount: canonical.size,
        units,
        inputBindings,
        outputBindings,
        diagnostics: ctx.diagnostics
      };
    } finally {
      for (const component of components) {
        component.destroy({ children: true });
      }
      for (const wire of wires) {
        wire.destroy();
      }
    }
  }
}
