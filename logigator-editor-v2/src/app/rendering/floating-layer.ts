import {
  Container,
  DestroyOptions,
  FederatedPointerEvent,
  Rectangle
} from 'pixi.js';
import { Subscription } from 'rxjs';
import { WorkMode } from '../work-mode/work-mode.enum';
import { Project } from '../project/project';
import { Component } from '../components/component';
import { roundToGrid, roundToHalfGrid } from '../utils/grid';
import { ComponentConfig } from '../components/component-config.model';
import { Wire } from '../wires/wire';
import { DragSession } from './drag-session';
import { ComponentPlacementSession } from './sessions/component-placement.session';
import { PastePlacementSession } from './sessions/paste-placement.session';
import { WireDrawingSession } from './sessions/wire-drawing.session';
import { SelectRectSession } from './sessions/select-rect.session';
import { SelectionMoveSession } from './sessions/selection-move.session';
import { EraseSession } from './sessions/erase.session';
import { WireConnectionSession } from './sessions/wire-connection.session';
import { ConnectionPoint } from '../connection-points/connection-point';
import { ShortcutService } from '../shortcuts/shortcut.service';
import { ShortcutActionEnum } from '../shortcuts/shortcut-action.enum';
import { getStaticDI } from '../utils/get-di';
import { BuiltInComponentType } from '../components/component-type.enum';

export class FloatingLayer extends Container {
  private readonly _dragLayer = new Container<
    Component | Wire | ConnectionPoint
  >();

  private _mode: WorkMode = WorkMode.WIRE_DRAWING;
  private _componentToPlace: ComponentConfig | null = null;
  private _activeDrag: DragSession | null = null;

  private _cancelSub?: Subscription;

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

    this._cancelSub = getStaticDI(ShortcutService)
      .on(ShortcutActionEnum.CANCEL)
      .subscribe(() => {
        if (this._activeDrag) {
          this._activeDrag.onCancel();
          this._stopDrag();
        }
      });
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

  public startPasteSession(components: Component[], wires: Wire[]): void {
    if (this._activeDrag) {
      this._activeDrag.onCancel();
      this._stopDrag();
    }
    this.project.selectionManager.clear();
    this._startDrag(
      new PastePlacementSession(
        this.project,
        this._dragLayer,
        components,
        wires
      )
    );
  }

  private onPointerDown(e: FederatedPointerEvent) {
    if (e.button !== 0) return;

    if (
      this._activeDrag instanceof PastePlacementSession &&
      !this._activeDrag.isDragging
    ) {
      const localPoint = e.getLocalPosition(this.project.gridSpace);
      if (this._activeDrag.containsPoint(localPoint)) {
        this._activeDrag.beginDrag(roundToGrid(localPoint, true));
      } else {
        this._activeDrag.onCancel();
        this._stopDrag();
      }
      return;
    }

    if (this._activeDrag) return;

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
      case WorkMode.SIMULATION: {
        // No drag sessions in simulation mode — editing is structurally
        // locked at the canvas level. The only interaction is clicking a
        // user-input component (button/lever).
        const localPoint = e.getLocalPosition(this.project.gridSpace);
        const queryRect = new Rectangle(
          localPoint.x - 0.5,
          localPoint.y - 0.5,
          1,
          1
        );
        for (const comp of this.project.queryComponentsInRange(queryRect)) {
          const type = comp.config.type;
          if (
            (type === BuiltInComponentType.BUTTON ||
              type === BuiltInComponentType.LEVER) &&
            comp.bodyGridBounds.contains(localPoint.x, localPoint.y)
          ) {
            this.project.emitUserInput(comp);
            break;
          }
        }
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
    this._cancelSub?.unsubscribe();
    super.destroy(options);
  }
}
