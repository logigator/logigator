import {
  BitmapText,
  Container,
  DestroyOptions,
  Graphics,
  GraphicsContext,
  Point,
  Rectangle
} from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { ComponentConfig, ComponentConfigView } from './component-config.model';
import { ThemingService } from '../theming/theming.service';
import { getStaticDI } from '../utils/get-di';
import { GraphicsProviderService } from '../rendering/graphics-provider.service';
import { ComponentGraphics } from '../rendering/graphics/component.graphics';
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
import {
  bodyGridBounds,
  bodyGridBoundsIntersects,
  ComponentShape,
  connectionPoints,
  gridBounds,
  gridBoundsIntersects,
  localConnectionPoints,
  negationBubbleAnchor,
  rotatedBox
} from './component-geometry';
import { Connectable } from '../rendering/grid-element';
import { IdAllocator } from '../utils/id-allocator';
import { ComponentMeta, Direction, OptionValues } from '@logigator/core';
import { CANVAS_FONT_FAMILY, fitMonoFontSize } from '../utils/text-fit';

export interface PortsChange {
  oldPorts: Point[];
  newPorts: Point[];
}

/**
 * Arity, port labels and body extent as pure functions of the option values
 * (plus the direction, for a body whose width must not follow the rotation).
 * A built-in's `ComponentMeta` is one; a custom component builds one from its
 * definition. `ComponentMeta<never>` is what a built-in's `as const` meta is
 * assignable to; `widenMeta` explains why erasing the value shape is safe.
 */
export type ComponentGeometrySource = Pick<
  ComponentMeta<never>,
  'ports' | 'labels' | 'body'
>;

/** The same source, read with the option-value record the base holds. */
type ComponentGeometry = Pick<ComponentMeta, 'ports' | 'labels' | 'body'>;

function readOptionValues(
  options: Record<string, ComponentOption>
): OptionValues {
  const values: Record<string, unknown> = {};
  for (const [key, option] of Object.entries(options)) {
    values[key] = option.value;
  }
  return values;
}

/**
 * Port-label anchor per direction, keyed by the side the *input* edge faces
 * (outputs use the opposite direction's entry). Anchoring to the body edge
 * rather than the counter-rotated label's centre keeps every label at the
 * same inset whatever its text width, matching the legacy editor.
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

  // Fires when port positions change (rotation, input/output count). Not
  // fired during construction.
  public readonly portsChange$ = new Subject<PortsChange>();

  protected readonly themingService: ThemingService =
    getStaticDI(ThemingService);
  protected readonly geometryService: GraphicsProviderService = getStaticDI(
    GraphicsProviderService
  );

  private _id: number;

  private _direction: Direction = Direction.E;
  private _appliedScale = 1;

  private readonly _geometry!: ComponentGeometry;
  private _optionValues: OptionValues = {};

  private _numInputs = 0;
  private _numOutputs = 0;
  private _bodyGridWidth = 1;
  private _bodyGridHeight = 1;

  /** Completed on destroy; unsubscribes the base's option watchers. */
  protected readonly destroy$ = new Subject<void>();

  private _rotationCounterContainers: Container[] = [];

  private _portStubs: Graphics[] = [];
  private _portBubbles = new Map<number, Graphics>();
  // Run in place on zoom instead of rebuilding the visual tree, which would
  // re-rasterize every Text per zoom step. Reset on each _draw().
  private _rescalers: ((scale: number) => void)[] = [];
  // Reset on each _draw(); refreshTheme runs them in place.
  private _themeRestylers: (() => void)[] = [];
  // Survives redraws; _drawConnections re-applies it to the rebuilt stubs.
  private readonly _poweredPorts = new Set<number>();

  // Indexed 0-based within each group; separate sets so an input-count change
  // cannot shift output indices. Out-of-range entries are ignored on read and
  // dropped on serialize, so a resize never mutates these — which is what
  // makes it undo-safe.
  private readonly _negatedInputs = new Set<number>();
  private readonly _negatedOutputs = new Set<number>();

  private _selected = false;

  private _initialized = false;

  public static serialize(component: Component): SerializedComponent {
    return {
      id: component.id,
      type: component.config.type,
      pos: [component.position.x, component.position.y],
      ...(component.direction !== Direction.E
        ? { direction: component.direction }
        : {}),
      options: Object.fromEntries(
        Object.entries(component.options).map(([key, opt]) => [key, opt.value])
      ),
      ...Component.serializeNegations(component)
    };
  }

  /**
   * Sorted, in-range negation indices: out-of-range entries left by a
   * port-count shrink are dropped and empty groups omitted.
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
    // Without an id, the constructor allocates a fresh one.
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
    if (serialized.direction) {
      // Before `pos`: the direction setter's fixed-body-anchor shift moves
      // `position`, which the absolute write below overrides. East is the
      // constructed default, so the common case pays no redraw.
      component.direction = serialized.direction;
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
    geometry: ComponentGeometrySource,
    options: Record<string, ComponentOption>
  ) {
    super();

    this._id = Component._idAllocator.next();
    this._geometry = geometry as ComponentGeometry;
    this.options = options as TOptions;
    this._optionValues = readOptionValues(options);

    const ports = this._geometry.ports(this._optionValues);
    this._numInputs = ports.inputs;
    this._numOutputs = ports.outputs;
    this._refreshBody();

    // Every option value feeds the geometry, so the base watches all of them.
    for (const option of Object.values(options)) {
      option.onChange$
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => this.onOptionsChanged());
    }

    this._initialized = true;

    this._draw();
  }

  /**
   * Re-derives arity, port labels and body extent. A change that moves the
   * ports re-anchors, redraws and fires `portsChange$` once even when both
   * counts move; one that does not still redraws, since labels and body width
   * read option values too.
   *
   * Override to react beyond redrawing; call `super` first.
   */
  protected onOptionsChanged(): void {
    this._optionValues = readOptionValues(this.options);
    const ports = this._geometry.ports(this._optionValues);

    if (
      ports.inputs === this._numInputs &&
      ports.outputs === this._numOutputs
    ) {
      this._refreshBody();
      this.redraw();
      return;
    }

    const oldPorts = this.connectionPoints;
    this._withFixedBodyAnchor(() => {
      this._numInputs = ports.inputs;
      this._numOutputs = ports.outputs;
      this._refreshBody();
    });
    this._draw();
    this.portsChange$.next({ oldPorts, newPorts: this.connectionPoints });
  }

  /** Cached: every bounds query (culling, collision, quad tree) reads it. */
  private _refreshBody(): void {
    const body = this._geometry.body(this._optionValues, this._direction);
    this._bodyGridWidth = body.width;
    this._bodyGridHeight = body.height;
  }

  protected get inputLabels(): string[] {
    return this._geometry.labels(this._optionValues).inputs;
  }

  protected get outputLabels(): string[] {
    return this._geometry.labels(this._optionValues).outputs;
  }

  protected get bodyGridWidth(): number {
    return this._bodyGridWidth;
  }

  protected get bodyGridHeight(): number {
    return this._bodyGridHeight;
  }

  protected abstract draw(): void;

  /**
   * Symbol rendered centred in the body; null for components whose body is
   * its own visual identity (button, switch, free text). Overrides must read
   * a module-level config constant, not `this.config` — this runs during the
   * base constructor's draw, before the subclass `config` field is assigned.
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
      // The body may be direction-dependent: the segment display keeps a
      // fixed upright width when turned.
      this._refreshBody();
    });

    // Label anchors and the stub-thickness side depend on the direction.
    this._draw();

    if (oldPorts) {
      this.portsChange$.next({ oldPorts, newPorts: this.connectionPoints });
    }
  }

  /**
   * Derived, never assigned: a pure function of the option values, re-derived
   * by {@link onOptionsChanged}. Change an option to change the arity.
   */
  public get numInputs(): number {
    return this._numInputs;
  }

  public get numOutputs(): number {
    return this._numOutputs;
  }

  /**
   * Runs a mutation that changes the body's size or rotation while holding
   * its top-left corner fixed, matching the legacy editor: the body is drawn
   * from and rotated around the local origin, so shifting `position` by the
   * change in `bodyGridBounds` keeps rotation from moving the element and
   * makes added ports expand it toward the bottom (E/W) or the right (S/N).
   * No-op before construction completes.
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
   * Registers a scale-dependent visual update; runs immediately and again on
   * every applyScale, without rebuilding. Call from draw() for anything whose
   * on-screen size must stay constant across zoom.
   */
  protected onApplyScale(rescale: (scale: number) => void): void {
    this._rescalers.push(rescale);
    rescale(this._appliedScale);
  }

  /**
   * Adds a Graphics that swaps to the scale-keyed cached context on every
   * applyScale. Affordable at zoom-gesture rate; never swap contexts per
   * simulation frame (see WireGraphics).
   */
  protected addScaledGraphics(
    contextFor: (scale: number) => GraphicsContext
  ): Graphics {
    const graphics = new Graphics();
    this.onApplyScale((scale) => (graphics.context = contextFor(scale)));
    return this.addChild(graphics);
  }

  /** Chamfered body outline (grid units); stroke stays screen-constant. */
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

  /**
   * Registers a theme-dependent color write; runs immediately and again on
   * every {@link refreshTheme}. Zoom does not run these — re-tinting per zoom
   * step would dirty render groups for nothing. Call from draw() for anything
   * reading a theme color.
   */
  protected onApplyTheme(restyle: () => void): void {
    this._themeRestylers.push(restyle);
    restyle();
  }

  /**
   * Restyles in place, never rebuilding children. The rescalers re-fetch the
   * scale-keyed contexts, whose cache key includes the theme, so context-baked
   * colors swap pointers with no object churn; the restylers rewrite instance
   * tints; the selection tint value is theme-keyed too.
   */
  public refreshTheme(): void {
    this.applyScale(this._appliedScale);
    for (const restyle of this._themeRestylers) {
      restyle();
    }
    this.refreshTint();
  }

  public override destroy(options?: DestroyOptions): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.portsChange$.complete();
    super.destroy(options);
  }

  /** The geometry functions' lattice invariants: `component-geometry.ts`. */
  private get _shape(): ComponentShape {
    return {
      direction: this._direction,
      numInputs: this._numInputs,
      numOutputs: this._numOutputs,
      bodyGridWidth: this.bodyGridWidth,
      bodyGridHeight: this.bodyGridHeight,
      position: this.position
    };
  }

  public get connectionPoints(): Point[] {
    return connectionPoints(this._shape);
  }

  /** See {@link negationBubbleAnchor} in `component-geometry.ts`. */
  public negationBubbleAnchor(side: PortSide, index: number): Point {
    return negationBubbleAnchor(this._shape, side, index);
  }

  /** Resets transient simulation visual state (button pressed, switch on). */
  public clearSimState(): void {
    // Overridden by user-input components.
  }

  /** Stub graphics in `connectionPoints` order (rebuilt on every redraw). */
  public get portStubs(): readonly Graphics[] {
    return this._portStubs;
  }

  /** Bubble graphics by `connectionPoints` index, only for negated ports. */
  public get portBubbles(): ReadonlyMap<number, Graphics> {
    return this._portBubbles;
  }

  public get negatedInputs(): ReadonlySet<number> {
    return this._negatedInputs;
  }

  public get negatedOutputs(): ReadonlySet<number> {
    return this._negatedOutputs;
  }

  public isPortNegated(side: PortSide, index: number): boolean {
    return this._negationSet(side).has(index);
  }

  /** No-op when already in that state, so undo/redo stay idempotent. */
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

  /** Replaces both negation sets in a single redraw. */
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
   * Thickens one port stub while its link is powered. `portIndex` follows
   * `connectionPoints` order. Per-frame hot path: state lands as a transform
   * on the stub only, never a context swap or redraw (see WireGraphics).
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

  /** Powered as last applied by the simulation (`connectionPoints` order). */
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
   * POWERED_WIRE_THICKNESS while powered, mirrored per _stubThicknessSign.
   * The pivot centres the powered scale-up on the unpowered pixel.
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

  public get bodyGridBounds(): Rectangle {
    return bodyGridBounds(this._shape);
  }

  /** Allocation-free mirror of {@link bodyGridBounds}. */
  public intersectsBodyGridBounds(rect: Rectangle): boolean {
    return bodyGridBoundsIntersects(this._shape, rect);
  }

  public get gridBounds(): Rectangle {
    return gridBounds(this._shape);
  }

  /** Allocation-free mirror of {@link gridBounds}. */
  public intersectsGridBounds(rect: Rectangle): boolean {
    return gridBoundsIntersects(this._shape, rect);
  }

  // Bounds the quad tree files and culls by. Components whose rendered extent
  // overflows their grid footprint widen this, so panning past the footprint
  // does not cull still-visible pixels.
  public get cullBounds(): Rectangle {
    return this.gridBounds;
  }

  // AABB in parent (gridSpace) coordinates of an unrotated local box
  // [x0, x1] × [y0, y1], rotated to the component's current direction.
  protected _rotatedBox(
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ): Rectangle {
    return rotatedBox(this._direction, this.position, x0, y0, x1, y1);
  }

  protected registerRotationCounterContainer(container: Container): Container {
    container.rotation = -this.rotation;
    this._rotationCounterContainers.push(container);
    return container;
  }

  public get selected(): boolean {
    return this._selected;
  }

  public set selected(value: boolean) {
    this._selected = value;
    this.refreshTint();
  }

  /**
   * Selection is a multiplicative tint over the themed children: a component
   * bakes several theme colors, so it cannot be white-based like a wire. Also
   * restores the tint after a transient one (collision red).
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
    this._themeRestylers = [];

    this.draw();
    this._drawSymbol();

    this._drawConnections(this._numInputs, 'inputs');
    this._drawConnections(this._numOutputs, 'outputs');

    // The selection tint value is theme-keyed, so a redraw re-derives it.
    this.refreshTint();

    if (SHOW_CONNECTION_POINTS) {
      const connPoints = new Graphics();

      for (const point of localConnectionPoints(this._shape)) {
        connPoints.rect(point.x - PX, point.y - PX, 2 * PX, 2 * PX);
      }
      connPoints.fill(0xffff00);

      this.addChild(connPoints);
      this.registerRotationCounterContainer(connPoints);
    }

    if (SHOW_ORIGINS) {
      const originGraphics = new Graphics();
      originGraphics.rect(0, 0, 2 * PX, 2 * PX);
      originGraphics.fill(0xffffff);
      this.addChild(originGraphics);
    }

    if (SHOW_HITBOXES) {
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

  /** S/N: bodyGridHeight, not width, spans the screen's horizontal axis. */
  private get _isVertical(): boolean {
    return this._direction === Direction.S || this._direction === Direction.N;
  }

  /**
   * Which local side of the port centre-line the stub's 1-px thickness hangs
   * on, so that after rotation it lands on the same screen side as a
   * connecting wire's (below for horizontal, left for vertical).
   */
  private get _stubThicknessSign(): 1 | -1 {
    return this._direction === Direction.W || this._direction === Direction.N
      ? -1
      : 1;
  }

  private _drawSymbol(): void {
    const symbol = this.symbol;
    if (!symbol) {
      return;
    }
    // The symbol is upright, so its room is the body's *screen* width. Port
    // labels flank it only in E/W and halve that room; in S/N they sit
    // above/below, leaving the full width.
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
        // White base over the white glyph atlas, themed by tint: a style.fill
        // write would rebuild the text's proxy context and re-run layout.
        fill: 0xffffff
      },
      anchor: { x: 0.5, y: 0.5 }
    });
    this.onApplyTheme(
      () => (text.tint = this.themingService.currentTheme().fontTint)
    );
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
      // White-base shared context (see WireGraphics), themed by tint; the
      // selection tint multiplies over it.
      this.onApplyTheme(
        () => (wire.tint = this.themingService.currentTheme().wire)
      );
      wire.position.set(0, i + 0.5);
      wire.scale.x = 0.5;
      // The shared wire rect hangs its thickness on the +y side of the
      // centre-line and Wire renders it at 0° or +90°, but W/N map +y to the
      // opposite screen side — hence the sign mirror in _applyStubThickness.
      // Runs immediately, so a redraw re-applies surviving powered state.
      this.onApplyScale((scale) =>
        this._applyStubThickness(wire, portIndex, scale)
      );
      this._portStubs[portIndex] = wire;
      container.addChild(wire);

      if (this.isPortNegated(type === 'inputs' ? 'in' : 'out', i)) {
        // A unit-diameter circle pinned by its body-facing tangent point to
        // the body edge, drawn after the stub so its white fill interrupts it
        // — the classic inverter look. The context is re-fetched per zoom so
        // the border stays a fixed 1 px. Always white, whatever the power.
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
        // Room before a label collides with its neighbour: in S/N labels sit
        // one grid pitch apart, in E/W the input and output labels share the
        // body row, each keeping its 2-px inset plus centre clearance.
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
            // White base, themed via tint — see _drawSymbol.
            fill: 0xffffff
          },
          anchor: LABEL_ANCHOR[anchorDirection]
        });
        this.onApplyTheme(
          () => (text.tint = this.themingService.currentTheme().fontTint)
        );
        text.scale.set(PX);

        // The anchor sits a fixed 2-px inset inward from the body edge on the
        // port's centre-line, and the counter-rotation turns about that point,
        // so the label hangs inward in every direction.
        if (type === 'inputs') {
          text.position.set(0.5 + 2 * PX, i + 0.5);
        } else {
          text.position.set(-2 * PX, i + 0.5);
        }

        this.registerRotationCounterContainer(text);
        container.addChild(text);
      }
    }

    // bodyGridWidth, not getLocalBounds().right: the latter includes the
    // stroke's miter extension and would place stubs ~sqrt(2)*PX too far
    // right, making valid touching connections collide.
    if (type === 'outputs') {
      container.position.x = this.bodyGridWidth;
    } else {
      container.position.x = -0.5;
    }

    this.addChild(container);
  }
}
