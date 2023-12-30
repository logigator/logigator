import * as PIXI from 'pixi.js';
import { ZoomPan } from './zoom-pan';
import { RendererChunkData } from './renderer-chunk-data';
import { Subject } from 'rxjs';
import { ThemingService } from '../../services/theming/theming.service';
import { takeUntil } from 'rxjs/operators';
import { ProjectsService } from '../../services/projects/projects.service';
import { Grid } from './grid';
import { environment } from '../../../environments/environment';
import { Element } from '../element';
import { CollisionFunctions } from '../collision-functions';
import { Project } from '../project';
import { Action } from '../action';
import { getStaticDI } from '../get-di';
import {
	ComponentScalable,
	isUpdatable,
	LGraphics
} from './graphics/l-graphics';
import { LGraphicsResolver } from './graphics/l-graphics-resolver';
import { ElementTypeId } from '../element-types/element-type-ids';
import { ConnectionPoint } from './graphics/connection-point';
import { IterableDiffers } from '@angular/core';
import { EditorAction } from '../editor-action';

export abstract class View extends PIXI.Container {
	public zoomPan: ZoomPan;

	public requestSingleFrame: () => Promise<void>;

	public readonly htmlContainer: HTMLElement;

	protected _chunks: RendererChunkData[][] = [];

	public connectionPoints: Map<string, ConnectionPoint> = new Map();
	public allElements: Map<number, LGraphics> = new Map();

	private chunksToRenderDiffer = getStaticDI(IterableDiffers)
		.find([])
		.create<{ x: number; y: number }>(this.chunksToRenderTrackBy);

	protected _destroySubject = new Subject<void>();

	protected readonly _project: Project;

	private themingService = getStaticDI(ThemingService);

	protected constructor(
		project: Project,
		htmlContainer: HTMLElement,
		requestSingleFrameFn: () => Promise<void>
	) {
		super();
		this._project = project;
		this.htmlContainer = htmlContainer;
		this.requestSingleFrame = requestSingleFrameFn;
		this.zoomPan = new ZoomPan(this);

		this.interactive = true;
		this.sortableChildren = true;
		this.hitArea = new PIXI.Rectangle(0, 0, Infinity, Infinity);

		this.themingService.showGridChanges$
			.pipe(takeUntil(this._destroySubject))
			.subscribe((show) => {
				this.onGridShowChange(show);
			});
	}

	abstract placeComponentOnView(element: Element);
	abstract isSimulationView(): boolean;

	protected applyOpenActions() {
		this.applyActionsToView(this._project.getOpenActions());
		this.requestSingleFrame().then(() => {
			for (const chunkRow of this._chunks) {
				for (const chunk of chunkRow) {
					if (!chunk) continue;
					chunk.container.visible = false;
					chunk.gridGraphics.visible = false;
				}
			}
			this.updateChunks();
			this.requestSingleFrame();
		});
	}

	public updateChunks() {
		const currentlyOnScreen = this.zoomPan.isOnScreen(
			this.htmlContainer.offsetHeight,
			this.htmlContainer.offsetWidth
		);
		const chunksToRender = this._project.chunksToRender(
			Grid.getGridPosForPixelPos(currentlyOnScreen.start),
			Grid.getGridPosForPixelPos(currentlyOnScreen.end)
		);
		const chunksToRenderChanges =
			this.chunksToRenderDiffer.diff(chunksToRender);
		chunksToRenderChanges.forEachItem((record) => {
			const chunkToRender = record.item;
			if (this.createChunkIfNeeded(chunkToRender.x, chunkToRender.y)) return;
			const chunk = this._chunks[chunkToRender.x][chunkToRender.y];
			chunk.container.visible = true;
			chunk.container.renderable = true;
			chunk.gridGraphics.visible = this.themingService.showGrid;
			chunk.gridGraphics.renderable = this.themingService.showGrid;
			if (chunk.scaledFor === this.zoomPan.currentScale) return;
			chunk.scaledFor = this.zoomPan.currentScale;
			if (this.themingService.showGrid) {
				chunk.gridGraphics.destroy();
				chunk.gridGraphics = Grid.generateGridGraphics(
					this.zoomPan.currentScale
				);
				chunk.gridGraphics.position = this.getChunkPos(
					chunkToRender.x,
					chunkToRender.y
				);
				this.addChildAt(chunk.gridGraphics, 0);
			}
			const chunkElems = chunk.container.children;
			for (const chunkElem of chunkElems) {
				(chunkElem as unknown as ComponentScalable).updateScale(
					this.zoomPan.currentScale
				);
			}
		});
		if (this.isSimulationView()) {
			chunksToRenderChanges.forEachAddedItem((record) => {
				for (const g of this._chunks[record.item.x][record.item.y].container
					.children) {
					(g as LGraphics).applySimState(this.zoomPan.currentScale);
				}
			});
		}
		chunksToRenderChanges.forEachRemovedItem((record) => {
			const removedChunk = record.item;
			this._chunks[removedChunk.x][removedChunk.y].container.visible = false;
			this._chunks[removedChunk.x][removedChunk.y].container.renderable = false;
			this._chunks[removedChunk.x][removedChunk.y].gridGraphics.visible = false;
			this._chunks[removedChunk.x][removedChunk.y].gridGraphics.renderable =
				false;
		});
	}

	private chunksToRenderTrackBy(index: number, item: { x: number; y: number }) {
		return `${item.x}:${item.y}`;
	}

	private onGridShowChange(show: boolean) {
		const currentlyOnScreen = this.zoomPan.isOnScreen(
			this.htmlContainer.offsetHeight,
			this.htmlContainer.offsetWidth
		);
		const chunksToRender = getStaticDI(
			ProjectsService
		).currProject.chunksToRender(
			Grid.getGridPosForPixelPos(currentlyOnScreen.start),
			Grid.getGridPosForPixelPos(currentlyOnScreen.end)
		);
		for (const chunkP of chunksToRender) {
			const chunk = this._chunks[chunkP.x][chunkP.y];
			if (show) {
				chunk.gridGraphics.destroy();
				chunk.gridGraphics = Grid.generateGridGraphics(
					this.zoomPan.currentScale
				);
				chunk.gridGraphics.position = this.getChunkPos(chunkP.x, chunkP.y);
				this.addChildAt(chunk.gridGraphics, 0);
			} else {
				chunk.gridGraphics.visible = false;
			}
		}
		this.requestSingleFrame();
	}

	protected getChunkPos(chunkX: number, chunkY: number): PIXI.Point {
		return Grid.getPixelPosForGridPos(
			new PIXI.Point(
				chunkX * environment.chunkSize,
				chunkY * environment.chunkSize
			)
		);
	}

	protected createChunk(x: number, y: number): boolean {
		if (this._chunks[x] && this._chunks[x][y]) return false;
		for (let i = 0; i <= x; i++)
			if (!this._chunks[i]) {
				this._chunks[i] = [];
			}
		for (let i = 0; i <= y; i++)
			if (!this._chunks[x][y] && this._chunks[x][y] !== undefined) {
				this._chunks[x].push(undefined);
			}
		this._chunks[x][y] = {
			gridGraphics: Grid.generateGridGraphics(this.zoomPan.currentScale),
			container: new PIXI.Container(),
			scaledFor: this.zoomPan.currentScale
		};
		this._chunks[x][y].container.sortableChildren = false;
		this._chunks[x][y].container.interactive = false;
		this._chunks[x][y].container.visible = true;
		this._chunks[x][y].gridGraphics.sortableChildren = false;
		this._chunks[x][y].gridGraphics.interactive = false;
		this._chunks[x][y].gridGraphics.visible = this.themingService.showGrid;
		return true;
	}

	protected createChunkIfNeeded(chunkX, chunkY): boolean {
		if (this.createChunk(chunkX, chunkY)) {
			const chunk = this._chunks[chunkX][chunkY];
			const chunkPos = this.getChunkPos(chunkX, chunkY);
			chunk.container.position = chunkPos;
			chunk.gridGraphics.position = chunkPos;
			this.addChildAt(chunk.gridGraphics, 0);
			this.addChildAt(chunk.container, 1);
			return true;
		}
		return false;
	}

	public applyZoom(
		action: EditorAction,
		centerX?: number,
		centerY?: number
	): boolean {
		if (!centerX || !centerY) {
			centerX = this.htmlContainer.offsetWidth / 2;
			centerY = this.htmlContainer.offsetHeight / 2;
		}
		if (action === EditorAction.ZOOM_IN) {
			return this.zoomPan.zoomBy(1.25, centerX, centerY);
		} else if (action === EditorAction.ZOOM_OUT) {
			return this.zoomPan.zoomBy(0.8, centerX, centerY);
		} else if (action === EditorAction.ZOOM_100) {
			return this.zoomPan.zoomTo100(centerX, centerY);
		}

		return false;
	}

	protected placeWireOnView(element: Element) {
		const graphics = LGraphicsResolver.getLGraphicsFromElement(
			this.zoomPan.currentScale,
			element
		);
		graphics.position = Grid.getLocalChunkPixelPosForGridPosWire(element.pos);
		this.addToCorrectChunk(graphics, element.pos);
		this.allElements.set(element.id, graphics);
	}

	protected addConnectionPointToView(pos: PIXI.Point) {
		const connPoint = new ConnectionPoint(pos, true, this.zoomPan.currentScale);
		this.addToCorrectChunk(connPoint, pos);
		this.connectionPoints.set(`${pos.x}:${pos.y}`, connPoint);
	}

	/**
	 * @return false if the sprite already is in the correct chunk, true if added
	 */
	public addToCorrectChunk(
		sprite: PIXI.DisplayObject,
		pos: PIXI.Point
	): boolean {
		const chunk = CollisionFunctions.gridPosToChunk(pos);

		if (
			!(this._chunks[chunk.x] && this._chunks[chunk.x][chunk.y]) ||
			this._chunks[chunk.x][chunk.y].container !== sprite.parent
		) {
			this.createChunkIfNeeded(chunk.x, chunk.y);
			this._chunks[chunk.x][chunk.y].container.addChild(sprite);
			return true;
		}
		return false;
	}

	private removeConnectionPoint(pos: PIXI.Point) {
		const key = `${pos.x}:${pos.y}`;
		if (!this.connectionPoints.has(key)) return;
		this.connectionPoints.get(key).destroy();
		this.connectionPoints.delete(key);
	}

	private moveMultipleAction(action: Action) {
		action.others.forEach((element) => {
			const sprite = this.allElements.get(element.id);
			this.addToCorrectChunk(sprite, element.pos);
			this.setLocalChunkPos(element, sprite);
		});
	}

	private removeComponentOrWire(element: Element) {
		if (!this.allElements.has(element.id)) {
			return;
		}
		this.allElements.get(element.id).destroy();
		this.allElements.delete(element.id);
	}

	private updateComponent(action: Action) {
		const sprite = this.allElements.get(action.element.id);
		if (isUpdatable(sprite)) {
			sprite.updateComponent(this.zoomPan.currentScale, action.element);
		}
	}

	public applyActionsToView(actions: Action[]) {
		// console.log('incoming actions');
		// console.log(actions);
		// Actions.printActions(actions);
		if (!actions) return;
		for (const action of actions) {
			this.applyAction(action);
		}
		this.updateChunks();
		this.requestSingleFrame();
	}

	private applyAction(action: Action) {
		switch (action.name) {
			case 'addComp':
				this.placeComponentOnView(action.element);
				break;
			case 'addWire':
				this.placeWireOnView(action.element);
				break;
			case 'remComp':
			case 'remWire':
				this.removeComponentOrWire(action.element);
				break;
			case 'conWire':
				this.addConnectionPointToView(action.pos);
				break;
			case 'dcoWire':
				this.removeConnectionPoint(action.pos);
				break;
			case 'movMult':
				this.moveMultipleAction(action);
				break;
			case 'rotComp':
			case 'numInpt':
			case 'ediData':
			case 'compOpt':
			case 'plugInd':
				this.updateComponent(action);
				break;
		}
	}

	public setLocalChunkPos(element: Element, sprite: PIXI.DisplayObject) {
		if (element.typeId === ElementTypeId.WIRE) {
			sprite.position = Grid.getLocalChunkPixelPosForGridPosWire(element.pos);
		} else {
			sprite.position = Grid.getLocalChunkPixelPosForGridPos(element.pos);
		}
	}

	public onZoom(action: EditorAction) {
		if (this.applyZoom(action)) {
			this.updateChunks();
			this.requestSingleFrame();
		}
	}

	public centerView() {
		for (let x = 0; x < this._project.currState.chunks.length; x++) {
			for (let y = 0; y < this._project.currState.chunks[x].length; y++) {
				if (
					this._project.currState.chunks[x][y] &&
					this._project.currState.chunks[x][y].elements.size > 0
				) {
					this.zoomPan.translateTo(this.getChunkPos(-x, -y));
					this.updateChunks();
					this.requestSingleFrame();
					return;
				}
			}
		}
		this.zoomPan.translateTo(new PIXI.Point(0, 0));
		this.updateChunks();
		this.requestSingleFrame();
	}

	public get project(): Project {
		return this._project;
	}

	public override destroy() {
		this._destroySubject.next();
		this._destroySubject.unsubscribe();
		super.destroy({
			children: true
		});
	}
}
