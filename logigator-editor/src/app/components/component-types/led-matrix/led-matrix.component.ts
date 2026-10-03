import { Container, Graphics } from 'pixi.js';
import { Component } from '../../component';
import { LedMatrixCellGraphics } from '../../../rendering/graphics/led-matrix-cell.graphics';
import { ledMatrixMeta, ledMatrixShape } from '@logigator/core';
import {
  ledMatrixComponentConfig,
  LedMatrixOptions
} from './led-matrix.config';

/**
 * A size×size LED display driven like a RAM: a row is latched from the data
 * inputs on the rising clock edge. The cells are the engine unit's outputs but
 * exist only inside the simulator; the compiler maps their links back onto
 * this component as pseudo-ports at `numInputs + cellIndex` (row-major).
 */
export class LedMatrixComponent extends Component<LedMatrixOptions> {
  public readonly config = ledMatrixComponentConfig;

  // Row-major cell graphics, assigned in draw(). The class-field define runs
  // after the base constructor's first draw and resets this to undefined, so a
  // state change before the next rebuild falls back to a full redraw.
  private _cells?: Graphics[];

  constructor(options: LedMatrixOptions) {
    super(ledMatrixMeta, options);
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

  protected draw(): void {
    const { size, bodyCells } = ledMatrixShape(this.options.size.value);
    this.addBody(bodyCells, bodyCells);

    // The grid spans the body minus a one-cell margin per side and stays
    // upright about the body centre, so row 0 always lights along the top of
    // the screen, as in the legacy editor.
    const context = this.geometryService.getGraphicsContext(
      LedMatrixCellGraphics
    );
    const span = bodyCells - 2;
    const pitch = span / size;
    const cellSize = pitch * 0.9;

    const grid = new Container();
    const cells: Graphics[] = (this._cells = []);
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const cell = new Graphics(context);
        cell.scale.set(cellSize);
        cell.position.set(
          col * pitch - span / 2 + (pitch - cellSize) / 2,
          row * pitch - span / 2 + (pitch - cellSize) / 2
        );
        cells.push(cell);
        grid.addChild(cell);
      }
    }
    // Draw-time setup and theme restyles; the per-frame path writes tints
    // directly in setPortPowered.
    this.onApplyTheme(() => {
      const theme = this.themingService.currentTheme();
      cells.forEach((cell, i) => {
        cell.tint = this.isPortPowered(this.numInputs + i)
          ? theme.ledOn
          : theme.ledOff;
      });
    });
    grid.position.set(bodyCells / 2, bodyCells / 2);
    this.registerRotationCounterContainer(grid);
    this.addChild(grid);
  }
}
