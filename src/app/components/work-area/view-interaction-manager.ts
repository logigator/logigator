import {View} from './view';
import {Grid} from './grid';
import * as PIXI from 'pixi.js';
import InteractionEvent = PIXI.interaction.InteractionEvent;
import {ElementSprite} from '../../models/element-sprite';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {SelectionService} from '../../services/selection/selection.service';
import {ProjectsService} from '../../services/projects/projects.service';
import {CollisionFunctions} from '../../models/collision-functions';
import {WorkMode} from '../../models/work-modes';
import {Subscription} from 'rxjs';
import {wire} from '../../models/element-types/wire';
import {ThemingService} from '../../services/theming/theming.service';

export class ViewInteractionManager {

	private _view: View;

	private _workModeSubscription: Subscription;

	private _actionStartPos: PIXI.Point;
	private _lastMousePos: PIXI.Point;

	private _newWireDir: 'hor' | 'ver';
	private _drawingNewWire = false;
	private _newWire: PIXI.Graphics;

	private _isSingleSelected: boolean;
	private _currentlyDragging = false;
	private _drawingSelectRect = false;
	private _selectRect: PIXI.Graphics;

	constructor(view: View) {
		this._view = view;
		this._selectRect = new PIXI.Graphics();
		this._newWire = new PIXI.Graphics();

		this.addEventListenersToView();
		this.addEventListenersToSelectRect();

		this._workModeSubscription = WorkModeService.staticInstance.currentWorkMode$.subscribe((mode) => this.onWorkModeChanged(mode));
	}

	private addEventListenersToView() {
		this._view.on('click', (e: InteractionEvent) => this.handleMouseClickOnView(e));
		this._view.on('pointerdown', (e: InteractionEvent) => this.handlePointerDownOnView(e));
		this._view.on('pointerup', (e: InteractionEvent) => this.handlePointerUpOnView(e));
		this._view.on('pointerupoutside', (e: InteractionEvent) => this.handlePointerUpOnView(e));
		this._view.on('pointermove', (e: InteractionEvent) => this.handlePointerMoveOnView(e));
	}

	private addEventListenersToSelectRect() {
		this._selectRect.interactive = true;
		this._selectRect.on('pointerdown', (e: InteractionEvent) => this.handlePointerDownOnSelectRect(e));
	}

	public addEventListenersToNewElement(elemSprite: ElementSprite) {
		elemSprite.sprite.interactive = true;
		elemSprite.sprite.on('pointerdown', (e: InteractionEvent) => this.handlePointerDownOnElement(e, elemSprite));
	}

	private handleMouseClickOnView(e: InteractionEvent) {
		if (WorkModeService.staticInstance.currentWorkMode === 'buildComponent') {
			this._view.placeComponent(
				Grid.getGridPosForPixelPos(e.data.getLocalPosition(this._view)),
				WorkModeService.staticInstance.currentComponentToBuild
			);
		}
	}

	private handlePointerDownOnView(e: InteractionEvent) {
		if (WorkModeService.staticInstance.currentWorkMode === 'select' && e.data.button === 0) {
			this.addSelectRectOrResetSelection(e);
		} else if (WorkModeService.staticInstance.currentWorkMode === 'buildWire' && e.data.button === 0) {
			this.startDrawingNewWire(e);
		}
	}

	private handlePointerUpOnView(e: InteractionEvent) {
		if (WorkModeService.staticInstance.currentWorkMode === 'select') {
			this.selectOrApplyMove();
		} else if (WorkModeService.staticInstance.currentWorkMode === 'buildWire' && e.data.button === 0) {
			this.addWire(e);
		}
	}

	private handlePointerMoveOnView(e: InteractionEvent) {
		if (WorkModeService.staticInstance.currentWorkMode === 'select') {
			this.drawSelectRectOrMove(e);
		} else if (WorkModeService.staticInstance.currentWorkMode === 'buildWire') {
			this.drawNewWire(e);
		}
	}

	private startDrawingNewWire(e: PIXI.interaction.InteractionEvent) {
		this._drawingNewWire = true;
		this._actionStartPos = Grid.getPixelPosForPixelPosOnGridWire(e.data.getLocalPosition(this._view));
		this._newWire.position = this._actionStartPos;
		this._view.addChild(this._newWire);
	}

	private addSelectRectOrResetSelection(e: PIXI.interaction.InteractionEvent) {
		if (e.target === this._view) {

			if (this._actionStartPos) {
				this.resetSelectionToOldPosition();
			}
			delete this._actionStartPos;
			this.clearSelection();
			this._drawingSelectRect = true;
			this._view.removeChild(this._selectRect);
			this._selectRect.position = e.data.getLocalPosition(this._view);
			this._selectRect.width = 0;
			this._selectRect.height = 0;
			this._selectRect.clear();
			this._selectRect.beginFill(ThemingService.staticInstance.getEditorColor('selectRect'), 0.3);
			this._selectRect.drawRect(0, 0, 1, 1);
		}
	}

	private selectOrApplyMove() {
		if (this._drawingSelectRect) {
			this._drawingSelectRect = false;
			const selectStart = Grid.getGridPosForPixelPos(this._selectRect.position);
			const selectEnd = Grid.getGridPosForPixelPos(new PIXI.Point(
				this._selectRect.position.x + this._selectRect.width,
				this._selectRect.position.y + this._selectRect.height)
			);
			this.selectInRect(selectStart, selectEnd);
			if (SelectionService.staticInstance.selectedIds().length === 0) {
				this._view.removeChild(this._selectRect);
			}
		} else if (this._currentlyDragging) {
			this._currentlyDragging = false;

			const movedDif = Grid.getGridPosForPixelPos(
				new PIXI.Point(this._lastMousePos.x - this._actionStartPos.x, this._lastMousePos.y - this._actionStartPos.y)
			);
			if (ProjectsService.staticInstance.currProject.moveElementsById(SelectionService.staticInstance.selectedIds(), movedDif)) {
				this._view.removeChild(this._selectRect);
				this.clearSelection();
				this._isSingleSelected = false;
				delete this._actionStartPos;
			}
		}
	}

	private addWire(e: InteractionEvent) {
		this._drawingNewWire = false;
		if (!this._actionStartPos) return;
		const wire1StartPos = Grid.getGridPosForPixelPos(this._actionStartPos);
		let wire2EndPos = Grid.getGridPosForPixelPos(e.data.getLocalPosition(this._view));
		let wire1End2StartPos;
		switch (this._newWireDir) {
			case 'hor':
				wire1End2StartPos = new PIXI.Point(wire2EndPos.x, wire1StartPos.y);
				break;
			case 'ver':
				wire1End2StartPos = new PIXI.Point(wire1StartPos.x, wire2EndPos.y);
				break;
			default:
				return;
		}
		if (!(wire1End2StartPos.x !== wire2EndPos.x || wire1End2StartPos.y !== wire2EndPos.y)) {
			wire2EndPos = undefined;
		}
		this._view.placeWires(wire1StartPos, wire1End2StartPos, wire2EndPos);

		this._newWire.clear();
		this._view.removeChild(this._newWire);
		delete this._newWireDir;
	}

	private drawNewWire(e: InteractionEvent) {
		if (this._drawingNewWire) {
			const currentMousePos = Grid.getPixelPosForPixelPosOnGridWire(e.data.getLocalPosition(this._view));
			const endPos = new PIXI.Point(currentMousePos.x - this._actionStartPos.x, currentMousePos.y - this._actionStartPos.y);
			this.setDirForNewWire(currentMousePos);
			this._newWire.clear();
			this._newWire.lineStyle(1 / this._view.zoomPan.currentScale, ThemingService.staticInstance.getEditorColor('wire'));
			this._newWire.moveTo(0, 0);
			switch (this._newWireDir) {
				case 'hor':
					this._newWire.lineTo(endPos.x, 0);
					this._newWire.lineTo(endPos.x, endPos.y);
					break;
				case 'ver':
					this._newWire.lineTo(0, endPos.y);
					this._newWire.lineTo(endPos.x, endPos.y);
					break;
			}
		}
	}

	private drawSelectRectOrMove(e: InteractionEvent) {
		if (this._drawingSelectRect) {
			if (!this._selectRect.parent) {
				this._view.addChild(this._selectRect);
			}
			const rectEndPos = e.data.getLocalPosition(this._view);
			this._selectRect.width = rectEndPos.x - this._selectRect.x;
			this._selectRect.height = rectEndPos.y -= this._selectRect.y;
		} else if (this._currentlyDragging) {
			const currentMousePos = Grid.getPixelPosOnGridForPixelPos(e.data.getLocalPosition(this._view));
			const dx = currentMousePos.x - this._lastMousePos.x;
			const dy = currentMousePos.y - this._lastMousePos.y;

			this._selectRect.position.x += dx;
			this._selectRect.position.y += dy;
			this.applyDraggingPositionChangeToSelection(dx, dy);

			this._lastMousePos = currentMousePos;
		}
	}

	private setDirForNewWire(currentMousePos) {
		if (!this._newWireDir && CollisionFunctions.distance(this._actionStartPos, currentMousePos) >= 1) {
			if (this._actionStartPos.x === currentMousePos.x) {
				this._newWireDir = 'ver';
			} else if (this._actionStartPos.y === currentMousePos.y) {
				this._newWireDir = 'hor';
			} else {

				this._newWireDir = 'ver';
			}
		}
	}

	private handlePointerDownOnSelectRect(e: InteractionEvent) {
		if (WorkModeService.staticInstance.currentWorkMode === 'select') {
			this.startDragging(e);
		}
	}

	private handlePointerDownOnElement(e: InteractionEvent, elem: ElementSprite) {
		if (WorkModeService.staticInstance.currentWorkMode === 'select') {
			if (this._isSingleSelected) {
				this.startDragging(e);
			} else {
				this.selectSingleComp(elem);
			}
		}
	}

	private applyDraggingPositionChangeToSelection(dx: number, dy: number) {
		SelectionService.staticInstance.selectedIds().forEach(id => {
			const sprite = this._view.allElements.get(id).sprite;
			sprite.position.x += dx;
			sprite.position.y += dy;
		});
	}

	private resetSelectionToOldPosition() {
		SelectionService.staticInstance.selectedIds(this._view.projectId).forEach(id => {
			const elemSprite = this._view.allElements.get(id);
			if (elemSprite.element.typeId === 0) {
				elemSprite.sprite.position = Grid.getLocalChunkPixelPosForGridPosWireStart(elemSprite.element.pos);
			} else {
				elemSprite.sprite.position = Grid.getLocalChunkPixelPosForGridPos(elemSprite.element.pos);
			}
		});
	}

	private startDragging(e: InteractionEvent) {
		this._currentlyDragging = true;
		this._lastMousePos = Grid.getPixelPosOnGridForPixelPos(e.data.getLocalPosition(this._view));
		if (!this._actionStartPos) {
			this._actionStartPos = this._lastMousePos;
		}
	}

	private clearSelection() {
		SelectionService.staticInstance.selectedIds(this._view.projectId).forEach(id => {
			if (this._view.allElements.has(id)) // stürzt sonst ab wenn dinge aus der selection gelöscht werden.
				this._view.allElements.get(id).sprite.tint = 0xffffff;
		});
		SelectionService.staticInstance.clearSelection();
		this._isSingleSelected = false;
	}

	private selectInRect(start: PIXI.Point, end: PIXI.Point) {
		this.clearSelection();
		const selected = SelectionService.staticInstance.selectFromRect(ProjectsService.staticInstance.currProject, start, end);
		selected.forEach(id => {
			this._view.allElements.get(id).sprite.tint = 0x8a8a8a;
		});
	}

	private selectSingleComp(elem: ElementSprite) {
		this.clearSelection();
		this._isSingleSelected = true;
		delete this._actionStartPos;
		this._view.removeChild(this._selectRect);
		elem.sprite.tint = 0x8a8a8a;
		SelectionService.staticInstance.selectComponent(elem.element.id);
	}

	private onWorkModeChanged(newMode: WorkMode) {
		this.resetSelectionToOldPosition();
		this.clearSelection();
		delete this._actionStartPos;
		delete this._newWireDir;
		delete this._lastMousePos;
		this._drawingSelectRect = false;
		this._drawingSelectRect = false;
		this._currentlyDragging = false;
		this._view.removeChild(this._selectRect);
		this._view.removeChild(this._newWire);
	}

	public destroy() {
		this._workModeSubscription.unsubscribe();
	}
}
