import { Container, Graphics, Point, Rectangle } from 'pixi.js';
import { Subscription } from 'rxjs';

import { DragSession } from '../drag-session';
import { PointerInput } from '../interaction/pointer-input';
import { Project } from '../../project/project';
import { WorkMode } from '../../work-mode/work-mode.enum';
import { ThemingService } from '../../theming/theming.service';
import { getStaticDI } from '../../utils/get-di';
import { ScissorKeyState } from '../interaction/scissor-key-state';

export class SelectRectSession implements DragSession {
  private readonly selectRect: Graphics;
  private _scissorDrawn: boolean;
  private readonly _heldSub: Subscription | null;

  /**
   * @param mode SELECT_EXACT scissors unconditionally.
   * @param scissorKey Live state of the hold-to-scissor key. `change$`
   *   restyles the marquee even under a motionless pointer; in SELECT mode the
   *   commit scissors when the key is held at release.
   */
  constructor(
    private readonly project: Project,
    private readonly parent: Container,
    private readonly startPos: Point,
    private readonly mode: WorkMode,
    private readonly scissorKey?: ScissorKeyState
  ) {
    this.selectRect = new Graphics();
    this._scissorDrawn = this._isScissor();
    this._drawRect();
    this.selectRect.alpha = 0.3;
    this.selectRect.position.copyFrom(startPos);
    this.selectRect.scale.set(0, 0);
    parent.addChild(this.selectRect);
    this._heldSub =
      scissorKey?.change$.subscribe(() => this._refreshScissorStyle()) ?? null;
  }

  onMove(input: PointerInput): void {
    const current = input.grid;
    this.selectRect.scale.set(
      current.x - this.startPos.x,
      current.y - this.startPos.y
    );
    this._refreshScissorStyle();
  }

  onEnd(): void {
    this._heldSub?.unsubscribe();
    const rect = this._normalizeRect();
    this.selectRect.destroy();
    this.project.selectionManager.commit(
      rect,
      this._isScissor() ? WorkMode.SELECT_EXACT : WorkMode.SELECT
    );
  }

  canEnd(): boolean {
    return true;
  }

  onCancel(): void {
    this._heldSub?.unsubscribe();
    this.selectRect.destroy();
  }

  private _isScissor(): boolean {
    return (
      this.mode === WorkMode.SELECT_EXACT ||
      (this.scissorKey?.isHeld() ?? false)
    );
  }

  private _refreshScissorStyle(): void {
    if (this._isScissor() === this._scissorDrawn) return;
    this._scissorDrawn = !this._scissorDrawn;
    this._drawRect();
  }

  private _drawRect(): void {
    const theme = getStaticDI(ThemingService).currentTheme();
    this.selectRect.clear();
    this.selectRect.rect(0, 0, 1, 1);
    this.selectRect.fill(
      this._scissorDrawn ? theme.scissorRect : theme.selectRect
    );
  }

  private _normalizeRect(): Rectangle {
    const sx = this.selectRect.scale.x;
    const sy = this.selectRect.scale.y;
    return new Rectangle(
      sx >= 0 ? this.startPos.x : this.startPos.x + sx,
      sy >= 0 ? this.startPos.y : this.startPos.y + sy,
      Math.abs(sx),
      Math.abs(sy)
    );
  }
}
