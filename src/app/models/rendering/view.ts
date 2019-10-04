import * as PIXI from 'pixi.js';
import {ZoomPanInputManager} from './zoom-pan-input-manager';
import {ZoomPan} from './zoom-pan';
import {Grid} from './grid';
import {ElementSprite} from '../element-sprite';
import {ProjectsService} from '../../services/projects/projects.service';
import {ElementProviderService} from '../../services/element-provider/element-provider.service';
import {Element} from '../element';
import {ViewInteractionManager} from './view-interaction-manager';
import {environment} from '../../../environments/environment';
import {Subject} from 'rxjs';
import {Action, Actions} from '../action';
import {CollisionFunctions} from '../collision-functions';
import {ThemingService} from '../../services/theming/theming.service';
import {CompSpriteGenerator} from './comp-sprite-generator';
import {ProjectInteractionService} from '../../services/project-interaction/project-interaction.service';
import {filter, takeUntil} from 'rxjs/operators';
import {SelectionService} from '../../services/selection/selection.service';
import {SimulationViewInteractionManager} from './simulation-view-interaction-manager';
import {RendererChunkData} from './renderer-chunk-data';
import {RenderTicker} from './render-ticker';

export class View extends PIXI.Container {

	private readonly _projectId: number;

	public zoomPan: ZoomPan;

	public ticker: RenderTicker;

	private readonly _onlySimMode: boolean;

	private _viewInteractionManager: ViewInteractionManager;
	private _simViewInteractionManager: SimulationViewInteractionManager;

	public readonly htmlContainer: HTMLElement;

	private _chunks: RendererChunkData[][] = [];

	public connectionPoints: Map<string, PIXI.Graphics> = new Map();
	public allElements: Map<number, ElementSprite> = new Map();

	private _chunksToRender: {x: number, y: number}[] = [];

	private _destroySubject =  new Subject<void>();

	constructor(projectId: number, htmlContainer: HTMLElement, ticker: RenderTicker, onlySimMode = false) {
		super();
		this._projectId = projectId;
		this.htmlContainer = htmlContainer;
		this.ticker = ticker;
		this.interactive = true;
		this.sortableChildren = true;
		this._onlySimMode = onlySimMode;

		this.zoomPan = new ZoomPan(this);
		if (!this._onlySimMode) {
			this._viewInteractionManager = new ViewInteractionManager(this);
		}
		this._simViewInteractionManager = new SimulationViewInteractionManager(this);

		ProjectsService.staticInstance.onProjectChanges$(this.projectId).pipe(
			takeUntil(this._destroySubject)
		).subscribe((actions: Action[]) => this.applyActionsToView(actions));

		ProjectInteractionService.staticInstance.onZoomChangeClick$.pipe(
			filter(_ => this.projectId === ProjectsService.staticInstance.currProject.id),
			takeUntil(this._destroySubject)
		).subscribe((dir => this.onZoomClick(dir)));

		ThemingService.staticInstance.showGridChanges$.pipe(
			takeUntil(this._destroySubject)
		).subscribe(show => {
			this.onGridShowChange(show);
		});

		this.applyActionsToView(
			ProjectsService.staticInstance.allProjects.get(this.projectId).getOpenActions()
		);
		this.updateChunks();
	}

	public updateChunks() {
		const currentlyOnScreen = this.zoomPan.isOnScreen(this.htmlContainer.offsetHeight, this.htmlContainer.offsetWidth);
		const chunksToRender = ProjectsService.staticInstance.currProject.chunksToRender(
			Grid.getGridPosForPixelPos(currentlyOnScreen.start),
			Grid.getGridPosForPixelPos(currentlyOnScreen.end)
		);
		for (let i = 0; i < chunksToRender.length; i++) {
			if (this.createChunkIfNeeded(chunksToRender[i].x, chunksToRender[i].y)) continue;
			const chunk = this._chunks[chunksToRender[i].x][chunksToRender[i].y];
			chunk.container.visible = true;
			chunk.gridGraphics.visible = ThemingService.staticInstance.showGrid;
			if (chunk.scaledFor === this.zoomPan.currentScale) continue;
			chunk.scaledFor = this.zoomPan.currentScale;
			if (ThemingService.staticInstance.showGrid) {
				chunk.gridGraphics.destroy();
				chunk.gridGraphics = Grid.generateGridGraphics(this.zoomPan.currentScale);
				chunk.gridGraphics.position = this.getChunkPos(chunksToRender[i].x, chunksToRender[i].y);
				this.addChildAt(chunk.gridGraphics, 0);
			}
			const chunkElems = chunk.container.children;
			for (let e = 0; e < chunkElems.length; e++) {
				const elemSprite = this.allElements.get(Number(chunkElems[e].name));
				if (elemSprite && elemSprite.element.typeId === 0) {
					this.updateWireSprite(elemSprite.element, elemSprite.sprite as PIXI.Graphics);
				} else if (elemSprite) {
					this.updateComponentSprite(elemSprite.element, elemSprite.sprite as PIXI.Graphics);
				}
				if (chunkElems[e].name === 'wireConnPoint') {
					this.updateConnectionPoint(chunkElems[e] as PIXI.Graphics);
				}
			}
		}
		const selectedIds = SelectionService.staticInstance.selectedIds(this.projectId);
		for (let i = 0; i < selectedIds.length; i++) {
			const elemSprite = this.allElements.get(selectedIds[i]);
			if (elemSprite.element.typeId === 0) {
				this.updateWireSprite(elemSprite.element, elemSprite.sprite as PIXI.Graphics);
			} else if (elemSprite) {
				this.updateComponentSprite(elemSprite.element, elemSprite.sprite as PIXI.Graphics);
			}
		}
		const selectedConnections = SelectionService.staticInstance.selectedConnections(this.projectId);
		for (let i = 0; i < selectedConnections.length; i++) {
			const graphics = this.connectionPoints.get(`${selectedConnections[i].x}:${selectedConnections[i].y}`);
			const pos = Grid.getPixelPosForPixelPosOnGridWire(graphics.position);
			this.drawConnectionPoint(graphics, pos);
		}
		for (const oldChunk of this._chunksToRender) {
			if (!chunksToRender.find(toRender => toRender.x === oldChunk.x && toRender.y === oldChunk.y)) {
				this._chunks[oldChunk.x][oldChunk.y].container.visible = false;
				this._chunks[oldChunk.x][oldChunk.y].gridGraphics.visible = false;
			}
		}
		this._chunksToRender = chunksToRender;
	}

	private onGridShowChange(show: boolean) {
		const currentlyOnScreen = this.zoomPan.isOnScreen(this.htmlContainer.offsetHeight, this.htmlContainer.offsetWidth);
		const chunksToRender = ProjectsService.staticInstance.currProject.chunksToRender(
			Grid.getGridPosForPixelPos(currentlyOnScreen.start),
			Grid.getGridPosForPixelPos(currentlyOnScreen.end)
		);
		for (const chunkP of chunksToRender) {
			console.log(chunkP);
			const chunk = this._chunks[chunkP.x][chunkP.y];
			if (show) {
				chunk.gridGraphics.destroy();
				chunk.gridGraphics = Grid.generateGridGraphics(this.zoomPan.currentScale);
				chunk.gridGraphics.position = this.getChunkPos(chunkP.x, chunkP.y);
				this.addChildAt(chunk.gridGraphics, 0);
			} else {
				chunk.gridGraphics.visible = false;
			}
		}
		this.ticker.singleFrame();
	}

	public drawConnectionPoint(graphics, pos) {
		const size = this.calcConnPointSize();
		graphics.clear();
		graphics.position = this.adjustConnPointPosToSize(pos, size);
		graphics.beginFill(ThemingService.staticInstance.getEditorColor('wire'));
		graphics.drawRect(0, 0, size / this.zoomPan.currentScale, size / this.zoomPan.currentScale);
	}

	public calcConnPointSize(): number {
		return this.zoomPan.currentScale < 0.5 ? 3 : 5;
	}

	public adjustConnPointPosToSize(pos: PIXI.Point, size: number): PIXI.Point {
		return new PIXI.Point(
			pos.x - size / 2 / this.zoomPan.currentScale,
			pos.y - size / 2 / this.zoomPan.currentScale
		);
	}

	private updateWireSprite(element: Element, graphics: PIXI.Graphics) {
		graphics.clear();
		this.addLineToWireGraphics(
			graphics,
			Grid.getPixelPosForGridPosWire(element.endPos),
			Grid.getPixelPosForGridPosWire(element.pos)
		);
	}

	private updateComponentSprite(element: Element, graphics: PIXI.Graphics) {
		graphics.clear();
		const elemType = ElementProviderService.staticInstance.getElementById(element.typeId);
		CompSpriteGenerator.updateGraphics(
			elemType.symbol, element.numInputs, element.numOutputs, element.rotation, this.zoomPan.currentScale, graphics
		);
	}

	private createChunk(x: number, y: number): boolean {
		if (this._chunks[x] && this._chunks[x][y])
			return false;
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
		this._chunks[x][y].container.hitArea = new PIXI.Rectangle(
			0,
			0,
			environment.chunkSize * environment.gridPixelWidth,
			environment.chunkSize * environment.gridPixelWidth
		);
		this._chunks[x][y].gridGraphics.sortableChildren = false;
		this._chunks[x][y].gridGraphics.visible = ThemingService.staticInstance.showGrid;
		const text = new PIXI.Text(x  + ' ' + y);
		text.x = (environment.chunkSize * environment.gridPixelWidth) / 2;
		text.y = (environment.chunkSize * environment.gridPixelWidth) / 2;
		this._chunks[x][y].container.addChild(text);
		return true;
	}

	private createChunkIfNeeded(chunkX, chunkY): boolean {
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

	private getChunkPos(chunkX: number, chunkY: number): PIXI.Point {
		return Grid.getPixelPosForGridPos(
			new PIXI.Point(chunkX * environment.chunkSize, chunkY * environment.chunkSize)
		);
	}

	public applyZoom(dir: 'in' | 'out' | '100', centerX?: number, centerY?: number): boolean {
		if (!centerX || !centerY) {
			centerX = this.htmlContainer.offsetWidth / 2;
			centerY = this.htmlContainer.offsetHeight / 2;
		}
		if (dir === 'in') {
			return this.zoomPan.zoomBy(1.25, centerX, centerY);
		} else if (dir === 'out') {
			return this.zoomPan.zoomBy(0.8, centerX, centerY);
		} else {
			return this.zoomPan.zoomTo100(centerX, centerY);
		}

	}

	private onZoomClick(dir: 'in' | 'out' | '100') {
		if (this.applyZoom(dir)) {
			this.updateChunks();
			this.ticker.singleFrame();
		}
	}

	public placeWires(start: PIXI.Point, middle: PIXI.Point, end?: PIXI.Point) {
		ProjectsService.staticInstance.allProjects.get(this.projectId).addWire(start, middle, end);
	}

	public placeComponent(position: PIXI.Point, typeId: number) {
		const type = ElementProviderService.staticInstance.getElementById(typeId);
		const project = ProjectsService.staticInstance.allProjects.get(this.projectId);
		return project.addElement(typeId, type.rotation, type.numInputs, type.numOutputs, position);
	}

	private placeComponentOnView(element: Element) {
		const elemType = ElementProviderService.staticInstance.getElementById(element.typeId);
		const sprite = CompSpriteGenerator.getComponentSprite(
			elemType.symbol, element.numInputs, element.numOutputs, element.rotation, this.zoomPan.currentScale
		);
		sprite.position = Grid.getLocalChunkPixelPosForGridPos(element.pos);
		sprite.name = element.id.toString();

		this.addToCorrectChunk(sprite, element.pos);

		const elemSprite = {element, sprite};
		this.allElements.set(element.id, elemSprite);

		if (!this._onlySimMode) {
			this._viewInteractionManager.addEventListenersToNewElement(elemSprite);
		}
		this._simViewInteractionManager.addEventListenersToNewElement(elemSprite);
	}

	private placeWireOnView(element: Element) {

		const endPos = Grid.getPixelPosForGridPosWire(element.endPos);
		const startPos = Grid.getPixelPosForGridPosWire(element.pos);

		const graphics = new PIXI.Graphics();
		graphics.position = Grid.getLocalChunkPixelPosForGridPosWireStart(element.pos);
		graphics.name = element.id.toString();
		this.addLineToWireGraphics(graphics, endPos, startPos);

		this.addToCorrectChunk(graphics, element.pos);

		const elemSprite = {element, sprite: graphics};
		this.allElements.set(element.id, elemSprite);
	}

	public addLineToWireGraphics(graphics: PIXI.Graphics, endPos: PIXI.Point, startPos: PIXI.Point) {
		graphics.lineStyle(1 / this.zoomPan.currentScale, ThemingService.staticInstance.getEditorColor('wire'));
		graphics.moveTo(0, 0);
		graphics.lineTo(endPos.x - startPos.x, endPos.y - startPos.y);
	}

	private addConnectionPoint(pos: PIXI.Point) {
		const pixelPos = Grid.getLocalChunkPixelPosForGridPosWireStart(pos);
		pixelPos.x -= 2.5 / this.zoomPan.currentScale;
		pixelPos.y -= 2.5 / this.zoomPan.currentScale;

		const graphics = new PIXI.Graphics();
		graphics.position = pixelPos;
		graphics.name = 'wireConnPoint';
		this.updateConnectionPoint(graphics);
		this.addToCorrectChunk(graphics, pos);

		this.connectionPoints.set(`${pos.x}:${pos.y}`, graphics);
	}

	private updateConnectionPoint(graphics: PIXI.Graphics) {
		const pos = Grid.getLocalChunkPixelPosForGridPosWireStart(Grid.getGridPosForPixelPos(graphics.position));
		this.drawConnectionPoint(graphics, pos);
	}

	private removeConnectionPoint(pos: PIXI.Point) {
		const key = `${pos.x}:${pos.y}`;
		if (!this.connectionPoints.has(key))
			return;
		this.connectionPoints.get(key).destroy();
		this.connectionPoints.delete(key);
	}

	private applyActionsToView(actions: Action[]) {
		// console.log('incoming actions');
		// Actions.printActions(actions);
		if (!actions)
			return;
		for (const action of actions) {
			this.applyAction(action);
		}
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
				if (!this.allElements.has(action.element.id)) break;
				this.allElements.get(action.element.id).sprite.destroy();
				this.allElements.delete(action.element.id);
				break;
			case 'conWire':
				this.addConnectionPoint(action.pos);
				break;
			case 'dcoWire':
				this.removeConnectionPoint(action.pos);
				break;
			case 'movMult':
				this.moveMultipleAction(action);
				break;
			case 'rotComp':
			case 'numInpt':
				this.updateComponent(action);
				break;
		}
		this.ticker.singleFrame();
	}

	private moveMultipleAction(action: Action) {
		action.others.forEach(element => {
			const elemSprite = this.allElements.get(element.id);
			this.addToCorrectChunk(elemSprite.sprite, element.pos);
			this.setLocalChunkPos(element, elemSprite.sprite);
		});
	}

	private updateComponent(action: Action) {
		const elemSprite = this.allElements.get(action.element.id);
		this.updateComponentSprite(action.element, elemSprite.sprite as PIXI.Graphics);
	}

	public setLocalChunkPos(element: Element, sprite: PIXI.DisplayObject) {
		if (element.typeId === 0) {
			sprite.position = Grid.getLocalChunkPixelPosForGridPosWireStart(element.pos);
		} else {
			sprite.position = Grid.getLocalChunkPixelPosForGridPos(element.pos);
		}
	}

	public addToCorrectChunk(sprite: PIXI.DisplayObject, pos: PIXI.Point) {
		const chunkX = CollisionFunctions.gridPosToChunk(pos.x);
		const chunkY = CollisionFunctions.gridPosToChunk(pos.y);

		this.createChunkIfNeeded(chunkX, chunkY);
		this._chunks[chunkX][chunkY].container.addChild(sprite);
	}

	public get projectId(): number {
		return this._projectId;
	}

	public destroy() {
		this._destroySubject.next();
		this._destroySubject.unsubscribe();
		if (!this._onlySimMode) {
			this._viewInteractionManager.destroy();
		}
		super.destroy({
			children: true
		});
	}

}
