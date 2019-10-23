import * as PIXI from 'pixi.js';
import {ZoomPan} from './zoom-pan';
import {RenderTicker} from './render-ticker';
import {RendererChunkData} from './renderer-chunk-data';
import {ElementSprite} from '../element-sprite';
import {Subject} from 'rxjs';
import {ThemingService} from '../../services/theming/theming.service';
import {takeUntil} from 'rxjs/operators';
import {ProjectsService} from '../../services/projects/projects.service';
import {Grid} from './grid';
import {environment} from '../../../environments/environment';
import {Element} from '../element';
import {ElementProviderService} from '../../services/element-provider/element-provider.service';
import {CompSpriteGenerator} from './comp-sprite-generator';
import {CollisionFunctions} from '../collision-functions';
import {Project} from '../project';
import {Action} from '../action';
import {getStaticDI} from '../get-di';

export abstract class View extends PIXI.Container {

	public zoomPan: ZoomPan;

	public ticker: RenderTicker;

	public readonly htmlContainer: HTMLElement;

	protected _chunks: RendererChunkData[][] = [];

	public connectionPoints: Map<string, PIXI.Graphics> = new Map();
	public allElements: Map<number, ElementSprite> = new Map();

	protected _chunksToRender: {x: number, y: number}[] = [];

	protected _destroySubject =  new Subject<void>();

	protected readonly _project: Project;

	private themingService = getStaticDI(ThemingService);
	private elementProviderService = getStaticDI(ElementProviderService);

	protected constructor(project: Project, htmlContainer: HTMLElement, ticker: RenderTicker) {
		super();
		this._project = project;
		this.htmlContainer = htmlContainer;
		this.ticker = ticker;
		this.zoomPan = new ZoomPan(this);

		this.interactive = true;
		this.sortableChildren = true;
		this.hitArea = new PIXI.Rectangle(0, 0, Infinity, Infinity);

		this.themingService.showGridChanges$.pipe(
			takeUntil(this._destroySubject)
		).subscribe(show => {
			this.onGridShowChange(show);
		});
	}

	protected applyOpenActions() {
		this.applyActionsToView(
			this._project.getOpenActions()
		);
		this.updateChunks();
	}

	public updateChunks() {
		const currentlyOnScreen = this.zoomPan.isOnScreen(this.htmlContainer.offsetHeight, this.htmlContainer.offsetWidth);
		const chunksToRender = this._project.chunksToRender(
			Grid.getGridPosForPixelPos(currentlyOnScreen.start),
			Grid.getGridPosForPixelPos(currentlyOnScreen.end)
		);
		for (let i = 0; i < chunksToRender.length; i++) {
			if (this.createChunkIfNeeded(chunksToRender[i].x, chunksToRender[i].y)) continue;
			const chunk = this._chunks[chunksToRender[i].x][chunksToRender[i].y];
			chunk.container.visible = true;
			chunk.gridGraphics.visible = this.themingService.showGrid;
			if (chunk.scaledFor === this.zoomPan.currentScale) continue;
			chunk.scaledFor = this.zoomPan.currentScale;
			if (this.themingService.showGrid) {
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
		const chunksToRender = getStaticDI(ProjectsService).currProject.chunksToRender(
			Grid.getGridPosForPixelPos(currentlyOnScreen.start),
			Grid.getGridPosForPixelPos(currentlyOnScreen.end)
		);
		for (const chunkP of chunksToRender) {
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

	protected getChunkPos(chunkX: number, chunkY: number): PIXI.Point {
		return Grid.getPixelPosForGridPos(
			new PIXI.Point(chunkX * environment.chunkSize, chunkY * environment.chunkSize)
		);
	}

	protected updateWireSprite(element: Element, graphics: PIXI.Graphics) {
		graphics.clear();
		this.addLineToWireGraphics(
			graphics,
			Grid.getPixelPosForGridPosWire(element.endPos),
			Grid.getPixelPosForGridPosWire(element.pos)
		);
	}

	protected updateComponentSprite(element: Element, graphics: PIXI.Graphics) {
		graphics.clear();
		const elemType = this.elementProviderService.getElementById(element.typeId);
		CompSpriteGenerator.updateGraphics(
			elemType.symbol, element.numInputs, element.numOutputs, element.rotation, this.zoomPan.currentScale, graphics
		);
	}

	protected createChunk(x: number, y: number): boolean {
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
		this._chunks[x][y].container.interactive = false;
		this._chunks[x][y].gridGraphics.sortableChildren = false;
		this._chunks[x][y].gridGraphics.interactive = false;
		this._chunks[x][y].gridGraphics.visible = this.themingService.showGrid;
		// const text = new PIXI.Text(x  + ' ' + y);
		// text.x = (environment.chunkSize * environment.gridPixelWidth) / 2;
		// text.y = (environment.chunkSize * environment.gridPixelWidth) / 2;
		// this._chunks[x][y].container.addChild(text);
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

	public addLineToWireGraphics(graphics: PIXI.Graphics, endPos: PIXI.Point, startPos: PIXI.Point) {
		graphics.lineStyle(1 / this.zoomPan.currentScale, this.themingService.getEditorColor('wire'));
		graphics.moveTo(0, 0);
		graphics.lineTo(endPos.x - startPos.x, endPos.y - startPos.y);
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

	protected placeComponentOnView(element: Element): ElementSprite {
		const elemType = this.elementProviderService.getElementById(element.typeId);
		const sprite = CompSpriteGenerator.getComponentSprite(
			elemType.symbol, element.numInputs, element.numOutputs, element.rotation, this.zoomPan.currentScale
		);
		sprite.position = Grid.getLocalChunkPixelPosForGridPos(element.pos);
		sprite.name = element.id.toString();

		this.addToCorrectChunk(sprite, element.pos);

		const elemSprite = {element, sprite};
		this.allElements.set(element.id, elemSprite);
		return elemSprite;
	}

	protected placeWireOnView(element: Element) {

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

	protected addConnectionPointToView(pos: PIXI.Point) {
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

	public addToCorrectChunk(sprite: PIXI.DisplayObject, pos: PIXI.Point) {
		const chunkX = CollisionFunctions.gridPosToChunk(pos.x);
		const chunkY = CollisionFunctions.gridPosToChunk(pos.y);

		this.createChunkIfNeeded(chunkX, chunkY);
		this._chunks[chunkX][chunkY].container.addChild(sprite);
	}

	protected updateConnectionPoint(graphics: PIXI.Graphics) {
		const pos = Grid.getLocalChunkPixelPosForGridPosWireStart(Grid.getGridPosForPixelPos(graphics.position));
		this.drawConnectionPoint(graphics, pos);
	}

	public drawConnectionPoint(graphics, pos) {
		const size = this.calcConnPointSize();
		graphics.clear();
		graphics.position = this.adjustConnPointPosToSize(pos, size);
		graphics.beginFill(this.themingService.getEditorColor('wire'));
		graphics.drawRect(0, 0, size / this.zoomPan.currentScale, size / this.zoomPan.currentScale);
	}

	private removeConnectionPoint(pos: PIXI.Point) {
		const key = `${pos.x}:${pos.y}`;
		if (!this.connectionPoints.has(key))
			return;
		this.connectionPoints.get(key).destroy();
		this.connectionPoints.delete(key);
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

	protected applyActionsToView(actions: Action[]) {
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
				this.updateComponent(action);
				break;
		}
		this.ticker.singleFrame();
	}

	public setLocalChunkPos(element: Element, sprite: PIXI.DisplayObject) {
		if (element.typeId === 0) {
			sprite.position = Grid.getLocalChunkPixelPosForGridPosWireStart(element.pos);
		} else {
			sprite.position = Grid.getLocalChunkPixelPosForGridPos(element.pos);
		}
	}

	protected onZoomClick(dir: 'in' | 'out' | '100') {
		if (this.applyZoom(dir)) {
			this.updateChunks();
			this.ticker.singleFrame();
		}
	}

	public get projectId(): number {
		return this._project.id;
	}

	public destroy() {
		this._destroySubject.next();
		this._destroySubject.unsubscribe();
		super.destroy({
			children: true
		});
	}

}
