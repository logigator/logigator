import { Container, DestroyOptions, Graphics } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { Component } from '../../component';
import { LedMatrixCellGraphics } from '../../../rendering/graphics/led-matrix-cell.graphics';
import {
  ledMatrixComponentConfig,
  LedMatrixOptions,
  ledMatrixShape
} from './led-matrix.config';

/**
 * A size×size LED display driven like a RAM: a row is latched from the data
 * inputs on the rising clock edge. The LED cells are the engine unit's
 * outputs but exist only inside the simulator — the compiler maps their links
 * back onto this component as pseudo-ports at `numInputs + cellIndex`
 * (row-major), delivered through the regular {@link Component.setPortPowered}
 * path.
 */
export class LedMatrixComponent extends Component<LedMatrixOptions> {
  public readonly config = ledMatrixComponentConfig;

  private readonly destroy$ = new Subject<void>();

  // Cell graphics in row-major LED order. Assigned in draw(); the class-field
  // define runs after the base constructor's first draw and resets it to
  // undefined, so a state change arriving before the next rebuild falls back
  // to a full redraw.
  private _cells?: Graphics[];

  constructor(options: LedMatrixOptions) {
    super(
      ledMatrixShape(options.size.value).numInputs,
      0,
      options.direction.value,
      options
    );

    this.options.direction.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.direction = this.options.direction.value;
      });

    this.options.size.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.numInputs = ledMatrixShape(this.options.size.value).numInputs;
      });
  }

  public override setPortPowered(portIndex: number, powered: boolean): void {
    super.setPortPowered(portIndex, powered);
    const cellIndex = portIndex - this.numInputs;
    if (cellIndex < 0) {
      return;
    }
    if (!this._cells) {
      this.redraw();
      return;
    }
    const cell = this._cells[cellIndex];
    if (cell) {
      const theme = this.themingService.currentTheme();
      cell.tint = powered ? theme.ledOn : theme.ledOff;
    }
  }

  protected get inputLabels(): string[] {
    const { addressBits, dataBits } = ledMatrixShape(this.options.size.value);
    const labels = [];
    for (let a = 0; a < addressBits; a++) {
      labels.push(`A${a}`);
    }
    for (let d = 0; d < dataBits; d++) {
      labels.push(`D${d}`);
    }
    labels.push('CLK');
    return labels;
  }

  protected get outputLabels(): string[] {
    return [];
  }

  protected get bodyGridWidth(): number {
    return ledMatrixShape(this.options.size.value).bodyCells;
  }

  // Square regardless of the port span (legacy geometry, mirrored by the
  // frozen legacy-anchor matrix case).
  protected override get bodyGridHeight(): number {
    return this.bodyGridWidth;
  }

  protected draw(): void {
    const { size, bodyCells } = ledMatrixShape(this.options.size.value);
    this.addBody(bodyCells, bodyCells);

    // The LED grid spans the body minus a one-cell margin per side and is
    // kept upright about the body centre — the square stays inside the body
    // across rotations, so row 0 always lights along the top of the screen
    // (legacy behavior).
    const theme = this.themingService.currentTheme();
    const context = this.geometryService.getGraphicsContext(
      LedMatrixCellGraphics
    );
    const span = bodyCells - 2;
    const pitch = span / size;
    const cellSize = pitch * 0.9;

    const grid = new Container();
    this._cells = [];
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const cell = new Graphics(context);
        cell.scale.set(cellSize);
        cell.tint = this.isPortPowered(this.numInputs + row * size + col)
          ? theme.ledOn
          : theme.ledOff;
        cell.position.set(
          col * pitch - span / 2 + (pitch - cellSize) / 2,
          row * pitch - span / 2 + (pitch - cellSize) / 2
        );
        this._cells.push(cell);
        grid.addChild(cell);
      }
    }
    grid.position.set(bodyCells / 2, bodyCells / 2);
    this.registerRotationCounterContainer(grid);
    this.addChild(grid);
  }

  public override destroy(options?: DestroyOptions): void {
    this.destroy$.next();
    super.destroy(options);
  }
}
