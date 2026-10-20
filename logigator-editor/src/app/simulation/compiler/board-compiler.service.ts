import { inject, Injectable } from '@angular/core';
import { TranslationService } from '../../translation/translation.service';
import { LoggingService } from '../../logging/logging.service';
import { Component } from '../../components/component';
import { isUserInput } from '../../components/user-input';
import { ComponentProviderService } from '../../components/component-provider.service';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import {
  BuiltInComponentType,
  CUSTOM_TYPE_ID_BASE,
  CustomComponentDefinition
} from '@logigator/core';
import { instantiateBody } from '../../persistence/circuit-builder';
import { encodeRomData } from '../../components/component-types/rom/rom-data.codec';
import { ledMatrixShape } from '@logigator/core';
import { Project } from '../../project/project';
import { Wire } from '../../wires/wire';
import {
  BoardComponentDescriptor,
  BoardComponentParams,
  ClockMode,
  CompiledBoard,
  RamRead,
  ENGINE_RECORDER_TYPE,
  ENGINE_USER_INPUT_TYPE,
  LinkRenderTargets,
  TERMINAL_RECORD_CAPACITY,
  TOP_LEVEL_PATH
} from './compiled-board.model';
import { CompileDiagnostic } from './compile-error';
import { extractNets, Net, UnionFind } from './net-extractor';
import {
  WatchChildBridge,
  WatchIndex,
  WatchInstanceRecord,
  WatchTemplateTables
} from './watch-index';

const UNIT_TYPES: ReadonlySet<number> = new Set([
  BuiltInComponentType.NOT,
  BuiltInComponentType.AND,
  BuiltInComponentType.OR,
  BuiltInComponentType.XOR,
  BuiltInComponentType.DELAY,
  BuiltInComponentType.CLOCK,
  BuiltInComponentType.HALF_ADDER,
  BuiltInComponentType.FULL_ADDER,
  BuiltInComponentType.D_FF,
  BuiltInComponentType.JK_FF,
  BuiltInComponentType.SR_FF,
  BuiltInComponentType.RNG,
  BuiltInComponentType.RAM,
  BuiltInComponentType.DECODER,
  BuiltInComponentType.ENCODER,
  BuiltInComponentType.MUX,
  BuiltInComponentType.DEMUX,
  BuiltInComponentType.ROM,
  BuiltInComponentType.TERMINAL
]);

/**
 * Unit types whose engine state the editor reads beside snapshots — a RAM's
 * memory — so their units are recorded by component.
 */
const STATE_TYPES: ReadonlySet<number> = new Set([BuiltInComponentType.RAM]);

/**
 * Unit types whose records the editor reads beside snapshots — a terminal's
 * characters — so their units are recorded by component.
 */
const RECORD_TYPES: ReadonlySet<number> = new Set([
  BuiltInComponentType.TERMINAL
]);

/**
 * Editor types whose engine type id is not their own. A terminal is the
 * engine's recorder: `D0`…`D7` its data bus and `CLK` its trigger, the
 * recorder's last input, so its ports are already in engine order.
 */
const ENGINE_TYPES: ReadonlyMap<number, number> = new Map([
  [BuiltInComponentType.TERMINAL, ENGINE_RECORDER_TYPE]
]);

/** One emitted unit, pins as union-find node ids (link ids come later). */
interface EmittedUnit {
  type: number;
  inputs: number[];
  outputs: number[];
  /** Negated pin indices into inputs[]/outputs[]; survive node remaps. */
  negInputs?: number[];
  negOutputs?: number[];
  /** Per-type parameters (e.g. ROM contents); survive node remaps. */
  params?: BoardComponentParams;
}

/**
 * A unit's fields past its pins, as the descriptor spells them. Pin remaps
 * preserve pin *order*, so negated indices and parameters carry over.
 */
function carriedFields(unit: EmittedUnit): {
  negInputs?: number[];
  negOutputs?: number[];
} & BoardComponentParams {
  return {
    ...(unit.negInputs ? { negInputs: unit.negInputs } : {}),
    ...(unit.negOutputs ? { negOutputs: unit.negOutputs } : {}),
    ...unit.params
  };
}

/**
 * A snapshot definition's circuit compiled once per session: units with
 * template-local net ids, plus the plug bindings tying local nets to the
 * instance's outer pins. Nested custom instances are already flattened in.
 */
interface CompiledTemplate {
  /** Every net class, wire-only ones included. */
  netCount: number;
  units: EmittedUnit[];
  /** Local net id per input pin, in plug-index order. */
  inputBindings: number[];
  /** Local net id per output pin, in plug-index order. */
  outputBindings: number[];
  /** Instance paths relative to the template's own circuit. */
  diagnostics: CompileDiagnostic[];
  /** Watch tables for live inner-circuit views, by body element index. */
  watch: WatchTemplateTables;
}

/** One directly placed custom instance, recorded for the watch index. */
interface EmittedInstance {
  typeId: number;
  /** The instance's node per template-local net, in this pass's node space. */
  localNodes: number[];
  /** Offset of the instance's units inside this pass's unit list. */
  unitBase: number;
}

/** Mutable state of one compilation pass over a single node-id space. */
interface EmitContext {
  uf: UnionFind;
  units: EmittedUnit[];
  diagnostics: CompileDiagnostic[];
  /**
   * Directly emitted user input: component id → its unit's index in this
   * pass.
   */
  userInputs: Map<number, number>;
  /**
   * Directly emitted unit of a {@link STATE_TYPES} type: component id → its
   * unit's index in this pass.
   */
  stateUnits: Map<number, number>;
  /** Directly emitted recorder: component id → its unit's index in this pass. */
  recordUnits: Map<number, number>;
  /** Directly placed custom instances, keyed by component id. */
  instances: Map<number, EmittedInstance>;
  /**
   * LED matrices with their engine-only cell nodes (unit outputs on no net).
   * The top-level pass maps them back onto the component as pseudo-ports;
   * inside a template they only feed the engine, so an inner matrix simulates
   * without lighting up in a watch.
   */
  displays: { component: Component; nodes: number[] }[];
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
 * link → render-target mapping. Synchronous: custom components expand from
 * their inlined snapshot circuits via session-cached templates.
 */
@Injectable({
  providedIn: 'root'
})
export class BoardCompilerService {
  private readonly provider = inject(ComponentProviderService);
  private readonly registry = inject(CustomComponentRegistry);
  private readonly logging = inject(LoggingService);
  private readonly translation = inject(TranslationService);

  // Keyed by snapshot type id; snapshots are frozen, so entries never
  // invalidate for the lifetime of the session.
  private readonly _templates = new Map<number, CompiledTemplate>();
  private readonly _templatesInProgress = new Set<number>();

  /** Within-group pin indices, sorted and omitted when empty — the shape the
   * engine consumes verbatim. */
  private _negationFor(component: Component): {
    negInputs?: number[];
    negOutputs?: number[];
  } {
    return Component.serializeNegations(component);
  }

  /**
   * Per-type engine parameters: ROM contents bit-packed to a byte table sized
   * `addressSize` × `wordSize` (`rom-data.codec.ts`), the clock's delay (the
   * ticks it stays low per cycle) and waveform, the RAM's read mode, and the
   * records a terminal's recorder keeps.
   */
  private _paramsFor(component: Component): BoardComponentParams | undefined {
    switch (component.config.type) {
      case BuiltInComponentType.ROM: {
        const contents = (component.options['data']?.value as string) ?? '';
        return {
          data: encodeRomData(
            contents,
            component.numInputs,
            component.numOutputs
          )
        };
      }
      case BuiltInComponentType.CLOCK:
        return {
          period: component.options['speed'].value as number,
          mode: component.options['mode'].value as ClockMode
        };
      case BuiltInComponentType.RAM:
        return { read: component.options['read'].value as RamRead };
      case BuiltInComponentType.TERMINAL:
        return { capacity: TERMINAL_RECORD_CAPACITY };
      default:
        return undefined;
    }
  }

  /**
   * The unit's input pins and their negations in the engine's pin order. A
   * DEMUX from a document older than its `pinOrder` takes its data input first,
   * where the engine reads it last, after the select bits; every other
   * component's ports are already in engine order.
   */
  private _enginePinOrder(
    component: Component,
    inputs: number[],
    negInputs: number[] | undefined
  ): { inputs: number[]; negInputs?: number[] } {
    if (
      component.config.type !== BuiltInComponentType.DEMUX ||
      component.options['pinOrder'].value !== 'dataFirst'
    ) {
      return { inputs, ...(negInputs ? { negInputs } : {}) };
    }
    const last = inputs.length - 1;
    const toEngine = (pin: number) => (pin === 0 ? last : pin - 1);
    return {
      inputs: [...inputs.slice(1), inputs[0]],
      ...(negInputs
        ? { negInputs: negInputs.map(toEngine).sort((a, b) => a - b) }
        : {})
    };
  }

  public compile(project: Project): CompiledBoard {
    const done = this.logging.time('compile board', 'BoardCompiler');
    const ctx: EmitContext = {
      uf: new UnionFind(),
      units: [],
      diagnostics: [],
      userInputs: new Map<number, number>(),
      stateUnits: new Map<number, number>(),
      recordUnits: new Map<number, number>(),
      instances: new Map<number, EmittedInstance>(),
      displays: []
    };

    const nets = extractNets({
      components: project.components,
      wires: project.wires,
      junctions: project.connectionPoints.cps
    });
    const netNodes = nets.map(() => ctx.uf.makeSet());
    const portNets = buildPortNetLookup(nets);

    // Quad-tree iteration order is not stable — sort by id so submission
    // order (and with it submitInput comp ids, the engine's input numbering
    // and the getOutputs layout) is reproducible.
    const components = [...project.components].sort((a, b) => a.id - b.id);
    this._unionTunnelNets(components, portNets, netNodes, ctx.uf);
    for (const component of components) {
      const pinNodes = (portNets.get(component) ?? []).map(
        (netIndex) => netNodes[netIndex]
      );
      this._emitComponent(component, pinNodes, TOP_LEVEL_PATH, ctx);
    }

    // Dense link ids over final classes referenced by ≥1 unit pin, in
    // emission order. Instantiation adds unions, so this runs only after all
    // expansion. Wire-only or plug-only classes get no link — never powered.
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
        outputs: unit.outputs.map(linkFor),
        ...carriedFields(unit)
      })
    );
    const linkCount = linkOfClass.size;

    const targets: LinkRenderTargets[] = Array.from(
      { length: linkCount },
      () => ({
        wires: [],
        ports: [],
        junctions: []
      })
    );
    nets.forEach((net, netIndex) => {
      const link = linkOfClass.get(ctx.uf.find(netNodes[netIndex]));
      if (link === undefined) return;
      // Plain loops, not `push(...net.wires)`: one net on a large board can
      // hold more wires than a spread call has argument slots.
      for (const wire of net.wires) targets[link].wires.push(wire);
      for (const port of net.ports) targets[link].ports.push(port);
      for (const junction of net.junctions) {
        targets[link].junctions.push(junction);
      }
    });
    // LED-matrix cells map back onto their component as pseudo-ports past the
    // input range (row-major), so the standard applier lights them.
    for (const { component, nodes } of ctx.displays) {
      nodes.forEach((node, cellIndex) => {
        targets[linkFor(node)].ports.push({
          component,
          portIndex: component.numInputs + cellIndex
        });
      });
    }

    // Each top-level instance's local nets resolved to global links; `-1` is
    // a wire-only class, never powered.
    const instances = new Map<string, WatchInstanceRecord>();
    for (const [id, instance] of ctx.instances) {
      instances.set(String(id), {
        typeId: instance.typeId,
        unitBase: instance.unitBase,
        linkOfLocalNet: Int32Array.from(
          instance.localNodes,
          (node) => linkOfClass.get(ctx.uf.find(node)) ?? -1
        )
      });
    }
    const templateTables = new Map<number, WatchTemplateTables>();
    for (const [typeId, template] of this._templates) {
      templateTables.set(typeId, template.watch);
    }

    this.logging.info(
      `compiled board: ${descriptorComponents.length} units, ${linkCount} links, ` +
        `${ctx.diagnostics.length} diagnostics`,
      'BoardCompiler'
    );
    done();

    return {
      descriptor: { components: descriptorComponents },
      linkCount,
      mapping: new Map([[TOP_LEVEL_PATH, targets]]),
      userInputs: ctx.userInputs,
      stateUnits: ctx.stateUnits,
      recordUnits: ctx.recordUnits,
      diagnostics: ctx.diagnostics,
      watch: new WatchIndex(instances, templateTables)
    };
  }

  /**
   * Joins the nets of tunnels sharing a label. Runs once per compilation pass,
   * so a label never leaks across a custom-component boundary.
   */
  private _unionTunnelNets(
    components: Component[],
    portNets: Map<Component, number[]>,
    netNodes: number[],
    uf: UnionFind
  ): void {
    const firstNodeOfLabel = new Map<string, number>();
    for (const component of components) {
      if (component.config.type !== BuiltInComponentType.TUNNEL) continue;
      const netIndex = portNets.get(component)?.[0];
      if (netIndex === undefined) continue;
      const label = component.options['label'].value as string;
      const node = netNodes[netIndex];
      const first = firstNodeOfLabel.get(label);
      if (first === undefined) {
        firstNodeOfLabel.set(label, node);
      } else {
        uf.union(first, node);
      }
    }
  }

  /**
   * Emits one component into the current node-id space: units directly,
   * custom instances by template instantiation. `pinNodes` holds the node of
   * the net at each port, in `connectionPoints` order.
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
        const unitBase = ctx.units.length;
        const localNodes = this._instantiateTemplate(
          template,
          pinNodes,
          joinPath(path, String(component.id)),
          ctx
        );
        ctx.instances.set(component.id, {
          typeId: type,
          localNodes,
          unitBase
        });
      }
      return;
    }

    if (type === BuiltInComponentType.LED_MATRIX) {
      // Cells are unit outputs with no editor port: fresh nodes on no net.
      // `dataBus` is the data-bus width the engine derives the pin split from.
      const { size, dataBits } = ledMatrixShape(
        component.options['size'].value as number
      );
      const cellNodes = Array.from({ length: size * size }, () =>
        ctx.uf.makeSet()
      );
      ctx.displays.push({ component, nodes: cellNodes });
      ctx.units.push({
        type,
        inputs: pinNodes,
        outputs: cellNodes,
        params: { dataBus: dataBits },
        ...this._negationFor(component)
      });
      return;
    }

    if (isUserInput(component) || type === BuiltInComponentType.KEYBOARD) {
      this._emitUserInput(component, pinNodes, ctx);
      return;
    }

    if (UNIT_TYPES.has(type)) {
      if (STATE_TYPES.has(type)) {
        ctx.stateUnits.set(component.id, ctx.units.length);
      }
      if (RECORD_TYPES.has(type)) {
        ctx.recordUnits.set(component.id, ctx.units.length);
      }
      const { negInputs, negOutputs } = this._negationFor(component);
      const params = this._paramsFor(component);
      ctx.units.push({
        type: ENGINE_TYPES.get(type) ?? type,
        ...this._enginePinOrder(
          component,
          pinNodes.slice(0, component.numInputs),
          negInputs
        ),
        outputs: pinNodes.slice(component.numInputs),
        ...(negOutputs ? { negOutputs } : {}),
        ...(params ? { params } : {})
      });
      return;
    }

    // These emit no unit, but their nets are mapped so their stubs light up:
    // TEXT has no ports; top-level plugs are inert decoration (inside a
    // template they are collected before emission and never reach here);
    // TUNNEL is joined at the net level; LED and SEGMENT_DISPLAY render the
    // powered state of their input nets.
    if (
      type === BuiltInComponentType.TEXT ||
      type === BuiltInComponentType.INPUT ||
      type === BuiltInComponentType.OUTPUT ||
      type === BuiltInComponentType.TUNNEL ||
      type === BuiltInComponentType.LED ||
      type === BuiltInComponentType.SEGMENT_DISPLAY
    ) {
      return;
    }

    ctx.diagnostics.push({
      kind: 'unsupported',
      instancePath: path,
      componentType: type,
      componentId: component.id,
      message: this.translation.translate('simulation.unsupportedComponent', {
        symbol: component.config.symbol
      })
    });
  }

  /**
   * A user input or a keyboard: one {@link ENGINE_USER_INPUT_TYPE} unit with
   * an output per output port, in port order, recorded in `userInputs`, so
   * slot `i` — output port `i` — is the unit's output `i` and one frame sets
   * every slot on one tick. What the outputs show over time — a pulse, a
   * held level, a key — is the frames' to say, not the descriptor's. A bubble
   * on output port `i` negates the unit's output `i`. Both have no inputs,
   * and a user input whose slot count is not its output count is a broken
   * type, refused here rather than mis-wired.
   */
  private _emitUserInput(
    component: Component,
    pinNodes: number[],
    ctx: EmitContext
  ): void {
    if (
      isUserInput(component) &&
      component.inputSlots !== component.numOutputs
    ) {
      throw new Error(
        `${component.config.symbol}: ${component.inputSlots} input slots ` +
          `for ${component.numOutputs} outputs`
      );
    }
    ctx.userInputs.set(component.id, ctx.units.length);
    ctx.units.push({
      type: ENGINE_USER_INPUT_TYPE,
      inputs: [],
      outputs: pinNodes.slice(component.numInputs),
      ...this._negationFor(component)
    });
  }

  /**
   * Materializes a placed instance: a fresh global node per template-local net,
   * each plug-bound local net unioned with the outer net at the matching
   * instance pin — so a plug wired straight to another plug merges the two
   * outer nets. Returns the instance's node per template-local net.
   */
  private _instantiateTemplate(
    template: CompiledTemplate,
    pinNodes: number[],
    path: string,
    ctx: EmitContext
  ): number[] {
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
        ...unit,
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
    return localNodes;
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
        message: this.translation.translate('simulation.recursiveComponent', {
          name: def?.name ?? snapshotTypeId
        })
      });
      return null;
    }
    if (!def?.circuit) {
      ctx.diagnostics.push({
        kind: 'missing-circuit',
        instancePath: path,
        componentType: snapshotTypeId,
        componentId: instanceId,
        message: this.translation.translate('simulation.componentNoCircuit', {
          name: def?.name ?? snapshotTypeId
        })
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
   * extracted, and destroyed again — never added to a Project.
   */
  private _buildTemplate(def: CustomComponentDefinition): CompiledTemplate {
    const done = this.logging.time(
      `build template "${def.name}"`,
      'BoardCompiler'
    );
    const { components, wires } = instantiateBody(this.provider, def.circuit!);
    try {
      const ctx: EmitContext = {
        uf: new UnionFind(),
        units: [],
        diagnostics: [],
        userInputs: new Map<number, number>(),
        stateUnits: new Map<number, number>(),
        recordUnits: new Map<number, number>(),
        instances: new Map<number, EmittedInstance>(),
        displays: []
      };
      const nets = extractNets({ components, wires });
      const netNodes = nets.map(() => ctx.uf.makeSet());
      const portNets = buildPortNetLookup(nets);
      const nodesOf = (component: Component): number[] =>
        (portNets.get(component) ?? []).map((netIndex) => netNodes[netIndex]);

      const inputPlugs: { component: Component; index: number }[] = [];
      const outputPlugs: { component: Component; index: number }[] = [];

      const sorted = [...components].sort((a, b) => a.id - b.id);
      this._unionTunnelNets(sorted, portNets, netNodes, ctx.uf);
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
          message: this.translation.translate('simulation.plugMismatch', {
            name: def.name,
            declaredInputs: def.numInputs,
            declaredOutputs: def.numOutputs,
            actualInputs: inputPlugs.length,
            actualOutputs: outputPlugs.length
          })
        });
      }

      // A plug's single port is its only connection point (portIndex 0).
      const inputBindingNodes = inputPlugs.map(
        (plug) => nodesOf(plug.component)[0]
      );
      const outputBindingNodes = outputPlugs.map(
        (plug) => nodesOf(plug.component)[0]
      );

      // Canonical template-local net ids: unit pins and plug bindings first
      // (their ids feed engine emission and must stay deterministic), then the
      // remaining classes so the watch can address inner wire-only nets too.
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
        ...unit,
        inputs: unit.inputs.map(localId),
        outputs: unit.outputs.map(localId)
      }));
      const inputBindings = inputBindingNodes.map(localId);
      const outputBindings = outputBindingNodes.map(localId);

      // Watch tables, keyed by element position in the instantiated body
      // arrays (deterministic across instantiateBody runs; live ids are not).
      const indexOfId = new Map(components.map((c, i) => [c.id, i]));
      const netOfWire = new Map<Wire, number>();
      nets.forEach((net, netIndex) => {
        for (const wire of net.wires) netOfWire.set(wire, netIndex);
      });
      const wireNets = Int32Array.from(wires, (wire) =>
        localId(netNodes[netOfWire.get(wire)!])
      );
      const watchPortNets = components.map((component) =>
        Int32Array.from(portNets.get(component) ?? [], (netIndex) =>
          localId(netNodes[netIndex])
        )
      );
      const userInputs = new Map<number, number>();
      for (const [id, unitIndex] of ctx.userInputs) {
        userInputs.set(indexOfId.get(id)!, unitIndex);
      }
      const stateUnits = new Map<number, number>();
      for (const [id, unitIndex] of ctx.stateUnits) {
        stateUnits.set(indexOfId.get(id)!, unitIndex);
      }
      const recordUnits = new Map<number, number>();
      for (const [id, unitIndex] of ctx.recordUnits) {
        recordUnits.set(indexOfId.get(id)!, unitIndex);
      }
      const children = new Map<number, WatchChildBridge>();
      for (const [id, instance] of ctx.instances) {
        children.set(indexOfId.get(id)!, {
          typeId: instance.typeId,
          netMap: Int32Array.from(instance.localNodes, localId),
          unitBase: instance.unitBase
        });
      }

      done();
      return {
        netCount: canonical.size,
        units,
        inputBindings,
        outputBindings,
        diagnostics: ctx.diagnostics,
        watch: {
          wireNets,
          portNets: watchPortNets,
          userInputs,
          stateUnits,
          recordUnits,
          children
        }
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
