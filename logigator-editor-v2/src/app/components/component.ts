import {
  BitmapText,
  Container,
  DestroyOptions,
  Graphics,
  GraphicsContext,
  Matrix,
  Point,
  Rectangle
} from 'pixi.js';
import { Subject } from 'rxjs';
import { ComponentConfig, ComponentConfigView } from './component-config.model';
import { ThemingService } from '../theming/theming.service';
import { getStaticDI } from '../utils/get-di';
import { GraphicsProviderService } from '../rendering/graphics-provider.service';
import { ComponentGraphics } from '../rendering/graphics/component.graphics';
import { environment } from '../../environments/environment';
import { PX } from '../utils/grid';
import {
  POWERED_WIRE_PIVOT,
  POWERED_WIRE_THICKNESS,
  WireGraphics
} from '../rendering/graphics/wire.graphics';
import {
  NegationBubbleGraphics,
  scaleForScale
} from '../rendering/graphics/negation-bubble.graphics';
import { ComponentOption } from './component-option';
import { SerializedComponent } from './serialized-component.model';
import { Connectable } from '../rendering/grid-element';
import { IdAllocator } from '../utils/id-allocator';
import { Direction } from '../utils/direction';
import { CANVAS_FONT_FAMILY, fitMonoFontSize } from '../utils/text-fit';

export interface PortsChange {
  oldPorts: Point[];
  newPorts: Point[];
}

/**
 * Port-label anchor per direction, keyed by the side the *input* edge faces
 * (outputs use the opposite direction's entry). Labels are counter-rotated to
 * stay horizontal, so the anchor picks the texture point that faces the body
 * edge. Anchoring to the edge — rather than rotating the label around its
 * centre — keeps every label at the same fixed inset regardless of its text
 * width (legacy-editor behavior).
 */
const LABEL_ANCHOR: Record<Direction, { x: number; y: number }> = {
  [Direction.E]: { x: 0, y: 0.5 },
  [Direction.S]: { x: 0.5, y: 0 },
  [Direction.W]: { x: 1, y: 0.5 },
  [Direction.N]: { x: 0.5, y: 1 }
};

const LABEL_FONT_SIZE = 0.4 / PX;
const SYMBOL_FONT_SIZE = 1 / PX;
const MIN_FONT_SIZE = 0.25 / PX;

/** Which port group a negation index addresses (0-based within that group). */
export type PortSide = 'in' | 'out';

export abstract class Component<
  TOptions extends Record<string, ComponentOption> = Record<
    string,
    ComponentOption
  >
>
  extends Container
  implements Connectable
{
  private static readonly _idAllocator = new IdAllocator();
  public abstract readonly config: ComponentConfigView<TOptions>;
  public readonly ignoresWireCollision: boolean = false;
  public readonly options: TOptions;

  // Fires when port positions change (rotation, input/output count). The listener
  // (typically Project) is responsible for refreshing derived state such as
  // connection-point markers. Not fired during construction.
  public readonly portsChange$ = new Subject<PortsChange>();

  protected readonly themingService: ThemingService =
    getStaticDI(ThemingService);
  protected readonly geometryService: GraphicsProviderService = getStaticDI(
    GraphicsProviderService
  );

  private _id: number;

  private _direction: Direction = Direction.E;
  private _appliedScale = 1;

  private _numInputs = 0;
  private _numOutputs = 0;

  private _rotationCounterContainers: Container[] = [];

  // Stub graphics in `connectionPoints` order, rebuilt by _drawConnections.
  private _portStubs: Graphics[] = [];
  // Inverter-bubble graphics keyed by `connectionPoints` index, only for
  // negated ports; rebuilt by _drawConnections alongside the stubs. Always
  // white — the bubble does not react to the port's power state.
  private _portBubbles = new Map<number, Graphics>();
  // Scale-dependent visual updates registered during draw(). applyScale runs
  // these in place on zoom instead of rebuilding the whole visual tree (which
  // would re-rasterize every Text on every zoom step). Reset on each _draw().
  private _rescalers: ((scale: number) => void)[] = [];
  // Powered port indexes survive redraws (zoom applyScale, theme change) —
  // _drawConnections re-applies them to the rebuilt stubs.
  private readonly _poweredPorts = new Set<number>();

  // Negated ports, indexed 0-based within each group (separate sets so an
  // input-count change can never shift output indices). Out-of-range entries
  // are ignored on read (rendering/serialize/compile) and pruned on serialize,
  // so a count change never has to mutate these — keeping resize undo-safe.
  private readonly _negatedInputs = new Set<number>();
  private readonly _negatedOutputs = new Set<number>();

  private _selected = false;

  private _initialized = false;

  public static serialize(component: Component): SerializedComponent {
    return {
      id: component.id,
      type: component.config.type,
      pos: [component.position.x, component.position.y],
      options: Object.fromEntries(
        Object.entries(component.options).map(([key, opt]) => [key, opt.value])
      ),
      ...Component.serializeNegations(component)
    };
  }

  /**
   * Sorted, in-range negation indices for serialization (native body, undo
   * snapshot, clipboard, server). Out-of-range entries left by a port-count
   * shrink are dropped here and empty groups are omitted, so a component with
   * no negation serializes to nothing. Single source of truth shared by both
   * the {@link SerializedComponent} and `SerializedComponentBody` producers.
   */
  public static serializeNegations(component: Component): {
    negInputs?: number[];
    negOutputs?: number[];
  } {
    const inRange = (set: ReadonlySet<number>, count: number) =>
      [...set].filter((i) => i < count).sort((a, b) => a - b);
    const negInputs = inRange(component.negatedInputs, component.numInputs);
    const negOutputs = inRange(component.negatedOutputs, component.numOutputs);
    return {
      ...(negInputs.length ? { negInputs } : {}),
      ...(negOutputs.length ? { negOutputs } : {})
    };
  }

  public static deserialize(
    // `id` is optional: if not specified, a fresh id is
    // allocated by the constructor.
    serialized: Omit<SerializedComponent, 'id' | 'type'> & { id?: number },
    config: ComponentConfig
  ): Component {
    const options = Object.fromEntries(
      Object.entries(config.options).map(([key, proto]) => [
        key,
        proto.clone(serialized.options[key])
      ])
    );
    const component = config.create(options);
    if (serialized.id !== undefined) {
      component.id = serialized.id;
    }
    component.position.set(serialized.pos[0], serialized.pos[1]);

    if (serialized.negInputs?.length || serialized.negOutputs?.length) {
      component.setNegations(
        serialized.negInputs ?? [],
        serialized.negOutputs ?? []
      );
    }

    return component;
  }

  protected constructor(
    numInputs: number,
    numOutputs: number,
    direction: Direction,
    options: Record<string, ComponentOption>
  ) {
    super();

    this._id = Component._idAllocator.next();

    this.numInputs = numInputs;
    this.numOutputs = numOutputs;
    this.direction = direction;
    this.options = options as TOptions;

    this._initialized = true;

    this._draw();
  }

  protected abstract get inputLabels(): string[];

  protected abstract get outputLabels(): string[];

  protected abstract get bodyGridWidth(): number;

  protected abstract draw(): void;

  /**
   * Symbol rendered centred in the body — normally the config's sidebar
   * symbol. Null (the default) for components whose body carries its own
   * visual identity instead (button, switch, free text). Overrides must read a
   * module-level config constant, not `this.config`: this is evaluated during
   * the base constructor's draw, before the subclass `config` field is
   * assigned.
   */
  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  protected get symbol(): string | null {
    return null;
  }

  public get id(): number {
    return this._id;
  }

  public set id(value: number) {
    Component._idAllocator.bump(value);
    this._id = value;
  }

  public get direction(): Direction {
    return this._direction;
  }

  public set direction(value: Direction) {
    const oldPorts = this._initialized ? this.connectionPoints : null;

    this._withFixedBodyAnchor(() => {
      this._direction = value;
      this.rotation = (value * Math.PI) / 2;
      for (const container of this._rotationCounterContainers) {
        container.rotation = -this.rotation;
      }
    });

    // Label anchors and the stub-thickness side both depend on the direction,
    // so rebuild the visual tree for the new rotation.
    this._draw();

    if (oldPorts) {
      this.portsChange$.next({ oldPorts, newPorts: this.connectionPoints });
    }
  }

  public get numInputs(): number {
    return this._numInputs;
  }

  public set numInputs(value: number) {
    const oldPorts = this._initialized ? this.connectionPoints : null;
    this._withFixedBodyAnchor(() => (this._numInputs = value));
    this._draw();
    if (oldPorts) {
      this.portsChange$.next({ oldPorts, newPorts: this.connectionPoints });
    }
  }

  public get numOutputs(): number {
    return this._numOutputs;
  }

  public set numOutputs(value: number) {
    const oldPorts = this._initialized ? this.connectionPoints : null;
    this._withFixedBodyAnchor(() => (this._numOutputs = value));
    this._draw();
    if (oldPorts) {
      this.portsChange$.next({ oldPorts, newPorts: this.connectionPoints });
    }
  }

  /**
   * Runs a mutation that changes the body's size or rotation while holding its
   * top-left corner fixed (legacy-editor behavior): the body is drawn from — and
   * rotated around — the local origin, so without this a turn would swing it off
   * its corner and a port-count change would grow it from the origin. Shifting
   * `position` by the change in `bodyGridBounds` keeps the corner put, so
   * rotation never moves the element and added ports expand it toward the bottom
   * (E/W) or the right (S/N). No-op before construction completes — the caller
   * sets `position` afterwards.
   */
  private _withFixedBodyAnchor(mutate: () => void): void {
    const oldAnchor = this._initialized ? this.bodyGridBounds : null;
    mutate();
    if (oldAnchor) {
      const newAnchor = this.bodyGridBounds;
      this.position.x += oldAnchor.x - newAnchor.x;
      this.position.y += oldAnchor.y - newAnchor.y;
    }
  }

  public get appliedScale(): number {
    return this._appliedScale;
  }

  public applyScale(scale: number): void {
    this._appliedScale = scale;
    for (const rescale of this._rescalers) {
      rescale(scale);
    }
  }

  /**
   * Registers a scale-dependent visual update. The callback runs immediately
   * with the current scale (so draw-time setup is covered) and again on every
   * applyScale, without rebuilding the component. Call from draw() for any
   * element whose on-screen size must stay constant across zoom.
   */
  protected onApplyScale(rescale: (scale: number) => void): void {
    this._rescalers.push(rescale);
    rescale(this._appliedScale);
  }

  /**
   * Adds a Graphics whose shared GraphicsContext depends on zoom scale, swapping
   * to the correctly-scaled cached context on every applyScale. Context swaps
   * are affordable at zoom-gesture rate, but never swap contexts per
   * simulation frame — see WireGraphics for the costs involved.
   */
  protected addScaledGraphics(
    contextFor: (scale: number) => GraphicsContext
  ): Graphics {
    const graphics = new Graphics();
    this.onApplyScale((scale) => (graphics.context = contextFor(scale)));
    return this.addChild(graphics);
  }

  /**
   * Adds the standard chamfered component body outline (width/height in grid
   * units) and keeps its stroke screen-constant across zoom.
   */
  protected addBody(width: number, height: number): Graphics {
    return this.addScaledGraphics((scale) =>
      this.geometryService.getGraphicsContext(
        ComponentGraphics,
        width,
        height,
        scale
      )
    );
  }

  public override destroy(options?: DestroyOptions): void {
    this.portsChange$.complete();
    super.destroy(options);
  }

  public get connectionPoints(): Point[] {
    return this._localConnectionPoints.map(
      (p) => new Point(this.position.x + p.x, this.position.y + p.y)
    );
  }

  /**
   * Grid-space body-edge point where the inverter bubble for a port (0-based
   * within its group) is pinned — the bubble's tangent point, from which it
   * grows outward along the stub. Mirrors the bubble placement in
   * `_drawConnections` so the port-negation tool's hover preview lands exactly
   * on the real bubble's spot.
   */
  public negationBubbleAnchor(side: PortSide, index: number): Point {
    const matrix = Matrix.IDENTITY.rotate(this.rotation);
    const local =
      side === 'in'
        ? new Point(0, index + 0.5)
        : new Point(this.bodyGridWidth, index + 0.5);
    const rotated = matrix.apply(local);
    return new Point(this.position.x + rotated.x, this.position.y + rotated.y);
  }

  /**
   * Resets transient simulation visual state (button pressed, switch on) when
   * a simulation stops. No-op for components without sim state.
   */
  public clearSimState(): void {
    // Overridden by user-input components.
  }

  /** Stub graphics in `connectionPoints` order (rebuilt on every redraw). */
  public get portStubs(): readonly Graphics[] {
    return this._portStubs;
  }

  /**
   * Inverter-bubble graphics keyed by `connectionPoints` index, present only
   * for negated ports (rebuilt on every redraw).
   */
  public get portBubbles(): ReadonlyMap<number, Graphics> {
    return this._portBubbles;
  }

  /** Negated input-port indices (0-based within the input group). Read-only. */
  public get negatedInputs(): ReadonlySet<number> {
    return this._negatedInputs;
  }

  /** Negated output-port indices (0-based within the output group). Read-only. */
  public get negatedOutputs(): ReadonlySet<number> {
    return this._negatedOutputs;
  }

  /** Whether port `index` on `side` is negated (an inverter bubble is drawn). */
  public isPortNegated(side: PortSide, index: number): boolean {
    return this._negationSet(side).has(index);
  }

  /**
   * Toggles negation on a single port. Rebuilds the visual tree (via redraw)
   * so the bubble appears/disappears immediately; a no-op when already in the
   * requested state, so undo/redo stay idempotent. Does not touch port counts,
   * so it never needs an out-of-range prune (see `_negatedInputs`).
   */
  public setPortNegated(side: PortSide, index: number, negated: boolean): void {
    const set = this._negationSet(side);
    if (set.has(index) === negated) {
      return;
    }
    if (negated) {
      set.add(index);
    } else {
      set.delete(index);
    }
    this.redraw();
  }

  private _negationSet(side: PortSide): Set<number> {
    return side === 'in' ? this._negatedInputs : this._negatedOutputs;
  }

  /**
   * Replaces both negation sets in a single redraw. Used by deserialize to
   * apply persisted negation after construction; callers skip it when there is
   * nothing to negate, so the common no-negation load pays no extra redraw.
   */
  public setNegations(
    inputs: Iterable<number>,
    outputs: Iterable<number>
  ): void {
    this._negatedInputs.clear();
    this._negatedOutputs.clear();
    for (const i of inputs) this._negatedInputs.add(i);
    for (const i of outputs) this._negatedOutputs.add(i);
    this.redraw();
  }

  /**
   * Thickens one port stub while its link is powered during simulation.
   * `portIndex` follows `connectionPoints` order. This is the per-frame hot
   * path, so state lands as a transform on the stub only — never a context
   * swap or redraw (see WireGraphics).
   */
  public setPortPowered(portIndex: number, powered: boolean): void {
    if (powered) {
      this._poweredPorts.add(portIndex);
    } else {
      this._poweredPorts.delete(portIndex);
    }
    const stub = this._portStubs[portIndex];
    if (stub) {
      this._applyStubThickness(stub, portIndex, this._appliedScale);
    }
  }

  /**
   * Whether the link on a port is powered, as last applied by the simulation
   * (`connectionPoints` order: inputs, then outputs). Live inspections read
   * this on each frame.
   */
  public isPortPowered(portIndex: number): boolean {
    return this._poweredPorts.has(portIndex);
  }

  /** Resets all port stubs to unpowered. */
  public clearPortPower(): void {
    this._poweredPorts.clear();
    for (const [portIndex, stub] of this._portStubs.entries()) {
      this._applyStubThickness(stub, portIndex, this._appliedScale);
    }
  }

  /**
   * Cross-axis transform of a stub: 1 screen pixel, times
   * POWERED_WIRE_THICKNESS while the port's link is powered, mirrored per
   * _stubThicknessSign. The pivot keeps the powered scale-up centred on the
   * unpowered pixel (sign-independent, see POWERED_WIRE_PIVOT).
   */
  private _applyStubThickness(
    stub: Graphics,
    portIndex: number,
    scale: number
  ): void {
    const powered = this._poweredPorts.has(portIndex);
    stub.scale.y =
      (PX / scale) *
      this._stubThicknessSign *
      (powered ? POWERED_WIRE_THICKNESS : 1);
    stub.pivot.y = powered ? POWERED_WIRE_PIVOT : 0;
  }

  private _bubbleContext(scale: number): GraphicsContext {
    return this.geometryService.getGraphicsContext(
      NegationBubbleGraphics,
      scale
    );
  }

  protected get bodyGridHeight(): number {
    return Math.max(1, this.numInputs, this.numOutputs);
  }

  public get bodyGridBounds(): Rectangle {
    return this._rotatedBounds(0, this.bodyGridWidth, this.bodyGridHeight);
  }

  public get gridBounds(): Rectangle {
    // Stub offsets in the component's unrotated local frame.
    // ly is always 0 — stubs are horizontal and don't extend the y extent.
    const lx = this.numInputs > 0 ? -0.5 : 0;
    const w =
      this.bodyGridWidth +
      (this.numInputs > 0 ? 0.5 : 0) +
      (this.numOutputs > 0 ? 0.5 : 0);
    return this._rotatedBounds(lx, w, this.bodyGridHeight);
  }

  // Bounds the quad tree files and culls by. Defaults to the logical
  // gridBounds; components whose rendered extent overflows their grid footprint
  // widen this so panning past the footprint doesn't cull still-visible pixels.
  public get cullBounds(): Rectangle {
    return this.gridBounds;
  }

  // AABB in parent (gridSpace) coordinates for a rectangle of size (w × h) with
  // an optional unrotated x-offset (lx), accounting for component rotation.
  private _rotatedBounds(lx: number, w: number, h: number): Rectangle {
    return this._rotatedBox(lx, 0, lx + w, h);
  }

  // AABB in parent (gridSpace) coordinates of an unrotated local box
  // [x0, x1] × [y0, y1], rotated to the component's current direction.
  // Generalizes _rotatedBounds, which assumes the box is anchored at y = 0.
  protected _rotatedBox(
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ): Rectangle {
    const x = this.position.x;
    const y = this.position.y;
    const w = x1 - x0;
    const h = y1 - y0;

    switch (this._direction) {
      case Direction.E:
        return new Rectangle(x + x0, y + y0, w, h);
      case Direction.S:
        return new Rectangle(x - y1, y + x0, h, w);
      case Direction.W:
        return new Rectangle(x - x1, y - y1, w, h);
      case Direction.N:
        return new Rectangle(x + y0, y - x1, h, w);
    }
  }

  protected registerRotationCounterContainer(container: Container): Container {
    container.rotation = -this.rotation;
    this._rotationCounterContainers.push(container);
    return container;
  }

  // Connection points must land exactly on the half-grid lattice: wires, the
  // net extractor, and the connection-point manager all match termination
  // points by exact coordinates, so any drift disconnects the port logically
  // while it still looks attached. Two consequences here:
  //   - Ports sit at the nominal stub tips, never at getLocalBounds(): the
  //     body stroke is screen-constant, so its grid-space extent grows as the
  //     zoom shrinks and below ~18% zoom it pokes past the stub tip.
  //   - Rotation is exact per-direction arithmetic (like _rotatedBounds), not
  //     a trig Matrix: cos/sin of the quarter-turns carry ~1e-16 noise that
  //     survives the final addition for components near the origin.
  private get _localConnectionPoints(): Point[] {
    const points: Point[] = [];

    for (let i = 0; i < this.numInputs; i++) {
      points.push(this._rotatedLocalPoint(-0.5, i + 0.5));
    }
    for (let i = 0; i < this.numOutputs; i++) {
      points.push(this._rotatedLocalPoint(this.bodyGridWidth + 0.5, i + 0.5));
    }

    return points;
  }

  /** Rotates an unrotated-frame local point by the component's direction. */
  private _rotatedLocalPoint(lx: number, ly: number): Point {
    switch (this._direction) {
      case Direction.E:
        return new Point(lx, ly);
      case Direction.S:
        return new Point(-ly, lx);
      case Direction.W:
        return new Point(-lx, -ly);
      case Direction.N:
        return new Point(ly, -lx);
    }
  }

  /** Whether the component carries the selection tint (see {@link refreshTint}). */
  public get selected(): boolean {
    return this._selected;
  }

  public set selected(value: boolean) {
    this._selected = value;
    this.refreshTint();
  }

  /**
   * Re-derives the container tint from the current theme and selection state.
   * Selection is a multiplicative tint over the themed children (a component
   * bakes several theme colors, so it cannot be white-based like a wire);
   * `theme.selectTint` darkens toward gray in both themes. Also the way to
   * restore the proper tint after a transient one (collision red).
   */
  public refreshTint(): void {
    this.tint = this._selected
      ? this.themingService.currentTheme().selectTint
      : 0xffffff;
  }

  public redraw(): void {
    this._draw();
  }

  private _draw(): void {
    if (!this._initialized) {
      return;
    }

    // destroy() calls removeFromParent which mutates `children` during
    // iteration — snapshot before iterating so every child gets destroyed.
    for (const child of [...this.children]) {
      child.destroy({ children: true });
    }
    this.removeChildren(0);

    this._rotationCounterContainers = [];
    this._portStubs = [];
    this._portBubbles = new Map();
    this._rescalers = [];

    this.draw();
    this._drawSymbol();

    this._drawConnections(this._numInputs, 'inputs');
    this._drawConnections(this._numOutputs, 'outputs');

    // The selection tint value is theme-keyed, so a theme-change redraw must
    // re-derive it alongside the rebuilt children.
    this.refreshTint();

    if (environment.debug.showConnectionPoints) {
      const connPoints = new Graphics();

      for (const point of this._localConnectionPoints) {
        connPoints.rect(point.x - PX, point.y - PX, 2 * PX, 2 * PX);
      }
      connPoints.fill(0xffff00);

      this.addChild(connPoints);
      this.registerRotationCounterContainer(connPoints);
    }

    if (environment.debug.showOrigins) {
      const originGraphics = new Graphics();
      originGraphics.rect(0, 0, 2 * PX, 2 * PX);
      originGraphics.fill(0xffffff);
      this.addChild(originGraphics);
    }

    if (environment.debug.showHitboxes) {
      const bounds = this.getLocalBounds();
      const hitbox = new Graphics();
      hitbox.rect(bounds.x, bounds.y, bounds.width, bounds.height);
      hitbox.fill({
        color: 0xff0000,
        alpha: 0.1
      });
      this.addChild(hitbox);
    }
  }

  private get _maxLabelLength(): number {
    return Math.max(
      ...this.inputLabels.map((l) => l.length),
      ...this.outputLabels.map((l) => l.length)
    );
  }

  /**
   * Whether the body stands upright on screen (rotated S/N), swapping which
   * of bodyGridWidth/bodyGridHeight spans the screen's horizontal axis.
   */
  private get _isVertical(): boolean {
    return this._direction === Direction.S || this._direction === Direction.N;
  }

  /**
   * Which local side of the port centre-line the stub's 1-px thickness hangs
   * on so that, after the component's rotation, it lands on the same screen
   * side as a connecting wire's thickness (below for horizontal, left for
   * vertical).
   */
  private get _stubThicknessSign(): 1 | -1 {
    return this._direction === Direction.W || this._direction === Direction.N
      ? -1
      : 1;
  }

  // Renders the symbol centred in the body, fitted to its slot with a 2-px
  // clearance per side, kept upright across rotations.
  private _drawSymbol(): void {
    const symbol = this.symbol;
    if (!symbol) {
      return;
    }
    // The symbol is kept upright, so its horizontal room is the body's
    // *screen* width: bodyGridWidth for E/W, bodyGridHeight for S/N. Port
    // labels flank the symbol on its own line only in E/W and halve its room
    // there; in S/N they sit above/below it, leaving the full width.
    const symbolSlot = this._isVertical
      ? this.bodyGridHeight / PX
      : this.bodyGridWidth / (this._maxLabelLength > 0 ? 2 : 1) / PX;
    const text = new BitmapText({
      text: symbol,
      style: {
        fontFamily: CANVAS_FONT_FAMILY,
        fontSize: fitMonoFontSize(
          symbol,
          symbolSlot - 4,
          SYMBOL_FONT_SIZE,
          MIN_FONT_SIZE
        ),
        fill: this.themingService.currentTheme().fontTint
      },
      anchor: { x: 0.5, y: 0.5 }
    });
    text.scale.set(PX);
    text.position.set(this.bodyGridWidth / 2, this.bodyGridHeight / 2);
    this.registerRotationCounterContainer(text);
    this.addChild(text);
  }

  private _drawConnections(n: number, type: 'inputs' | 'outputs'): void {
    const geometry = this.geometryService.getGraphicsContext(WireGraphics);
    const container = new Container();
    const labels = type === 'inputs' ? this.inputLabels : this.outputLabels;

    for (let i = 0; i < n; i++) {
      const portIndex = type === 'inputs' ? i : this._numInputs + i;
      const wire = new Graphics(geometry);
      // The shared stub context is a white base (see WireGraphics); the theme's
      // wire color is applied as tint. The component-level selection tint
      // multiplies over it, exactly as it does over the themed body stroke.
      wire.tint = this.themingService.currentTheme().wire;
      wire.position.set(0, i + 0.5);
      wire.scale.x = 0.5;
      // Stub stays 1 screen pixel thick: scale.y compensates for zoom. The
      // shared wire rect hangs its whole thickness on the +y side of the
      // centre-line, and Wire renders it at 0° or +90°, so the pixel always
      // lands below (horizontal) or left (vertical) of the line. The W/N
      // rotations map +y to the opposite screen side, which would leave the
      // stub one pixel off the wire it touches — the sign mirror in
      // _applyStubThickness makes the stub fill the same pixel as the wire.
      // Runs immediately, so a redraw re-applies any surviving powered state.
      this.onApplyScale((scale) =>
        this._applyStubThickness(wire, portIndex, scale)
      );
      this._portStubs[portIndex] = wire;
      container.addChild(wire);

      if (this.isPortNegated(type === 'inputs' ? 'in' : 'out', i)) {
        // Sits on the stub at the body edge so its white fill interrupts the
        // stub — the classic inverter look. Added after the stub so it draws on
        // top. A unit-diameter circle pinned by its tangent point (the extreme
        // facing the body) to the body edge and grown outward along the stub.
        // The transform sizes the white dot via negationBubbleScaleForScale; the
        // context is re-fetched per zoom so the border stays a fixed 1px (see
        // NegationBubbleGraphics). Always white — it does not react to power.
        const bubble = new Graphics();
        const bodyEdgeX = type === 'inputs' ? 0.5 : 0;
        bubble.pivot.set(type === 'inputs' ? 0.5 : -0.5, 0);
        bubble.position.set(bodyEdgeX, i + 0.5);
        this.onApplyScale((scale) => {
          bubble.context = this._bubbleContext(scale);
          bubble.scale.set(scaleForScale(scale));
        });
        this._portBubbles.set(portIndex, bubble);
        container.addChild(bubble);
      }

      if (labels.length > i) {
        const anchorDirection =
          type === 'inputs'
            ? this._direction
            : (((this._direction + 2) % 4) as Direction);
        // The horizontal room a label may take before it collides with its
        // neighbour: rotated S/N the labels sit side by side one grid pitch
        // apart, in E/W the input and output label share the body row, each
        // side keeping its 2-px inset plus clearance at the centre.
        const labelSlot = this._isVertical
          ? 1 / PX - 2
          : this.bodyGridWidth / 2 / PX - 4;
        const text = new BitmapText({
          text: labels[i],
          style: {
            fontFamily: CANVAS_FONT_FAMILY,
            fontSize: fitMonoFontSize(
              labels[i],
              labelSlot,
              LABEL_FONT_SIZE,
              MIN_FONT_SIZE
            ),
            fill: this.themingService.currentTheme().fontTint
          },
          anchor: LABEL_ANCHOR[anchorDirection]
        });
        text.scale.set(PX);

        // The anchor point sits a fixed 2-px inset inward from the body edge
        // on the port's centre-line; the counter-rotation (applied by
        // registerRotationCounterContainer) turns about that point, so the
        // label hangs inward from the edge in every direction.
        if (type === 'inputs') {
          text.position.set(0.5 + 2 * PX, i + 0.5);
        } else {
          text.position.set(-2 * PX, i + 0.5);
        }

        this.registerRotationCounterContainer(text);
        container.addChild(text);
      }
    }

    // For outputs: use bodyGridWidth (path right edge) not getLocalBounds().right,
    // which includes the stroke's miter extension and would place stubs ~sqrt(2)*PX
    // too far right — causing valid touching connections to falsely collide.
    if (type === 'outputs') {
      container.position.x = this.bodyGridWidth;
    } else {
      container.position.x = -0.5;
    }

    this.addChild(container);
  }
}
