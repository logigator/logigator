import {
  Container,
  DestroyOptions,
  FederatedPointerEvent,
  Rectangle
} from 'pixi.js';
import { WorkMode } from '../work-mode/work-mode.enum';
import { Project } from '../project/project';
import { Component } from '../components/component';
import { roundToGrid, roundToHalfGrid } from '../utils/grid';
import { ComponentConfig } from '../components/component-config.model';
import { Wire } from '../wires/wire';
import { DragSession } from './drag-session';
import { ComponentPlacementSession } from './sessions/component-placement.session';
import { WireDrawingSession } from './sessions/wire-drawing.session';
import { SelectRectSession } from './sessions/select-rect.session';
import { SelectionMoveSession } from './sessions/selection-move.session';
import { EraseSession } from './sessions/erase.session';
import { WireConnectionSession } from './sessions/wire-connection.session';
import { ConnectionPoint } from '../connection-points/connection-point';

export class FloatingLayer extends Container {
  private readonly _dragLayer = new Container<
    Component | Wire | ConnectionPoint
  >();

  private _mode: WorkMode = WorkMode.WIRE_DRAWING;
  private _componentToPlace: ComponentConfig | null = null;
  private _activeDrag: DragSession | null = null;

  private readonly _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this._activeDrag) {
      this._activeDrag.onCancel();
      this._stopDrag();
    }
  };

  constructor(private readonly project: Project) {
    super();

    this.interactiveChildren = false;
    this.eventMode = 'static';

    this.boundsArea = new Rectangle(
      -Number.MAX_VALUE / 2,
      -Number.MAX_VALUE / 2,
      Number.MAX_VALUE,
      Number.MAX_VALUE
    );
    this.hitArea = this.boundsArea;

    this.addChild(this._dragLayer);

    this.on('pointerdown', this.onPointerDown);
    window.addEventListener('keydown', this._onKeyDown);
  }

  public updateScale(scale: number) {
    for (const child of this._dragLayer.children) {
      child.applyScale(scale);
    }
  }

  public get mode(): WorkMode {
    return this._mode;
  }

  public set mode(value: WorkMode) {
    if (this._activeDrag) {
      this._activeDrag.onCancel();
      this._stopDrag();
    }
    this.project.selectionManager.clear();
    this._mode = value;
    this.project.triggerTicker('single');
  }

  public get componentToPlace(): ComponentConfig | null {
    return this._componentToPlace;
  }

  public set componentToPlace(value: ComponentConfig | null) {
    this._componentToPlace = value;
  }

  private onPointerDown(e: FederatedPointerEvent) {
    if (this._activeDrag || e.button !== 0) return;

    switch (this._mode) {
      case WorkMode.COMPONENT_PLACEMENT: {
        if (!this._componentToPlace) return;
        const startPos = roundToGrid(
          e.getLocalPosition(this.project.gridSpace),
          true
        );
        this._startDrag(
          new ComponentPlacementSession(this.project, this._dragLayer, startPos)
        );
        break;
      }
      case WorkMode.WIRE_DRAWING: {
        const startPos = roundToHalfGrid(
          e.getLocalPosition(this.project.gridSpace),
          true
        );
        this._startDrag(
          new WireDrawingSession(this.project, this._dragLayer, startPos)
        );
        break;
      }
      case WorkMode.SELECT:
      case WorkMode.SELECT_EXACT: {
        const localPoint = e.getLocalPosition(this.project.gridSpace);
        if (
          !this.project.selectionManager.isEmpty &&
          this.project.selectionManager.containsPoint(localPoint)
        ) {
          this._startDrag(
            new SelectionMoveSession(
              this.project,
              this._dragLayer,
              this.project.selectionManager.selectedComponents,
              this.project.selectionManager.selectedWires,
              roundToGrid(localPoint, true)
            )
          );
        } else {
          this._startDrag(
            new SelectRectSession(this.project, this, localPoint, this._mode)
          );
        }
        break;
      }
      case WorkMode.ERASE: {
        const startPos = e.getLocalPosition(this.project.gridSpace);
        this._startDrag(new EraseSession(this.project, startPos));
        break;
      }
      case WorkMode.WIRE_CONNECTION: {
        const startPos = roundToHalfGrid(
          e.getLocalPosition(this.project.gridSpace)
        );
        this._startDrag(new WireConnectionSession(this.project, startPos));
        break;
      }
    }
  }

  private onPointerMove(e: FederatedPointerEvent) {
    this._activeDrag?.onMove(e);
  }

  private onPointerUp() {
    const session = this._activeDrag;
    if (!session) return;
    if (!session.canEnd()) return;
    session.onEnd();
    this._stopDrag();
  }

  private _startDrag(session: DragSession): void {
    this._activeDrag = session;
    this.on('pointerup', this.onPointerUp);
    this.on('pointerupoutside', this.onPointerUp);
    this.on('pointermove', this.onPointerMove);
    this.project.triggerTicker('on');
  }

  private _stopDrag(): void {
    this.off('pointerup', this.onPointerUp);
    this.off('pointerupoutside', this.onPointerUp);
    this.off('pointermove', this.onPointerMove);
    this._activeDrag = null;
    this.project.triggerTicker('off');
  }

  override destroy(options?: DestroyOptions) {
    window.removeEventListener('keydown', this._onKeyDown);
    super.destroy(options);
  }
}
