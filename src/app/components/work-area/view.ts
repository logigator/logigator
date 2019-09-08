import * as PIXI from 'pixi.js';
import {ZoomPanInputManager} from './zoom-pan-input-manager';
import {ZoomPan} from './zoom-pan';
import {Grid} from './grid';
import {ElementSprite} from '../../models/element-sprite';
import {ProjectsService} from '../../services/projects/projects.service';
import {ElementProviderService} from '../../services/component-provider/element-provider.service';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {Element} from '../../models/element';
import {ViewInteractionManager} from './view-interaction-manager';
import {Project} from '../../models/project';
import {environment} from '../../../environments/environment';
import {SelectionService} from '../../services/selection/selection.service';
import {Subscription} from 'rxjs';
import {Action} from '../../models/action';
import {CollisionFunctions} from '../../models/collision-functions';

export class View extends PIXI.Container {

	private readonly _projectId: number;

	private _zoomPan: ZoomPan;

	private _zoomPanInputManager: ZoomPanInputManager;

	private _viewInteractionManager: ViewInteractionManager;

	private readonly _htmlContainer: HTMLElement;

	public readonly projectsService: ProjectsService;
	private readonly _elementProviderService: ElementProviderService;
	public readonly workModeService: WorkModeService;
	public readonly selectionService: SelectionService;

	private _chunks: PIXI.Container[][] = [];
	private _gridGraphics: PIXI.Graphics[][] = [];

	public allElements: Map<number, ElementSprite> = new Map();

	private _chunksToRender: {x: number, y: number}[] = [];

	private _notificationsFromProjectServiceSubscription: Subscription;

	constructor(
		projectId: number,
		htmlContainer: HTMLElement,
		projectsService: ProjectsService,
		compProviderService: ElementProviderService,
		workModeService: WorkModeService,
		selectionService: SelectionService
	) {
		super();
		this._projectId = projectId;
		this._htmlContainer = htmlContainer;
		this.projectsService = projectsService;
		this._elementProviderService = compProviderService;
		this.workModeService = workModeService;
		this.selectionService = selectionService;
		this.interactive = true;

		this._zoomPan = new ZoomPan(this);
		this._zoomPanInputManager = new ZoomPanInputManager(this._htmlContainer);
		this._viewInteractionManager = new ViewInteractionManager(this);

		this._notificationsFromProjectServiceSubscription =
			this.projectsService.subscribeToChanges(this.projectId)
				.subscribe((actions: Action[]) => this.applyActionsToView(actions));

		this.updateChunks();
	}

	public static createEmptyView(
		projectId: number,
		htmlContainer: HTMLElement,
		projectsService: ProjectsService,
		compProviderService: ElementProviderService,
		workModeService: WorkModeService,
		selectionService: SelectionService
	): View {
		return new View(projectId, htmlContainer, projectsService, compProviderService, workModeService, selectionService);
	}

	private updateChunks() {
		const currentlyOnScreen = this._zoomPan.isOnScreen(this._htmlContainer.offsetHeight, this._htmlContainer.offsetWidth);
		const chunksToRender = this.projectsService.currProject.chunksToRender(
			Grid.getGridPosForPixelPos(currentlyOnScreen.start),
			Grid.getGridPosForPixelPos(currentlyOnScreen.end)
		);
		chunksToRender.forEach(chunk => {
			if (this.createChunk(chunk.x, chunk.y)) {
				this._chunks[chunk.x][chunk.y].position = Grid.getPixelPosForGridPos(
					new PIXI.Point(chunk.x * environment.chunkSize, chunk.y * environment.chunkSize)
				);
				this.addChild(this._chunks[chunk.x][chunk.y]);
				this._chunks[chunk.x][chunk.y].addChild(this._gridGraphics[chunk.x][chunk.y]);
			} else {
				this._gridGraphics[chunk.x][chunk.y].destroy();
				this._gridGraphics[chunk.x][chunk.y] = Grid.generateGridGraphics(this._zoomPan.currentScale);
				this._chunks[chunk.x][chunk.y].addChild(this._gridGraphics[chunk.x][chunk.y]);
				this._chunks[chunk.x][chunk.y].visible = true;
			}
		});
		for (const oldChunk of this._chunksToRender) {
			if (!chunksToRender.find(toRender => toRender.x === oldChunk.x && toRender.y === oldChunk.y)) {
				this._chunks[oldChunk.x][oldChunk.y].visible = false;
			}
		}
		this._chunksToRender = chunksToRender;
	}

	private createChunk(x: number, y: number): boolean {
		if (this._chunks[x] && this._chunks[x][y])
			return false;
		for (let i = 0; i <= x; i++)
			if (!this._chunks[i]) {
				this._chunks[i] = [];
				this._gridGraphics[i] = [];
			}
		for (let i = 0; i <= y; i++)
			if (!this._chunks[x][y] && this._chunks[x][y] !== undefined) {
				this._gridGraphics[x].push(undefined);
				this._chunks[x].push(undefined);
			}
		this._gridGraphics[x][y] = Grid.generateGridGraphics(this._zoomPan.currentScale);
		this._chunks[x][y] = new PIXI.Container();
		const text = new PIXI.Text(x  + ' ' + y);
		text.x = 20 * 10;
		text.y = 20 * 10;
		this._chunks[x][y].addChild(text);
		return true;
	}

	public updateZoomPan() {
		let needsChunkUpdate = false;
		if (this._zoomPanInputManager.isDragging) {
			this._zoomPan.translateBy(this._zoomPanInputManager.mouseDX, this._zoomPanInputManager.mouseDY);
			this._zoomPanInputManager.clearMouseDelta();
			needsChunkUpdate = true;
		}

		if (this._zoomPanInputManager.isZoomIn) {
			needsChunkUpdate = this._zoomPan.zoomBy(0.75, this._zoomPanInputManager.mouseX, this._zoomPanInputManager.mouseY) || needsChunkUpdate;
		} else if (this._zoomPanInputManager.isZoomOut) {
			needsChunkUpdate = this._zoomPan.zoomBy(1.25, this._zoomPanInputManager.mouseX, this._zoomPanInputManager.mouseY) || needsChunkUpdate;
		}

		if (needsChunkUpdate) {
			this.updateChunks();
		}
	}

	public placeComponent(position: PIXI.Point, elementTypeId: number) {
		const elem = this.placeComponentInModel(position, elementTypeId);
		this.placeComponentOnView(elem);
	}

	private placeComponentOnView(element: Element) {
		const elemType = this._elementProviderService.getComponentById(element.typeId);
		if (!elemType.texture) {
			this._elementProviderService.generateTextureForElement(element.typeId);
		}
		const sprite = new PIXI.Sprite(elemType.texture);
		sprite.position = Grid.getLocalChunkPixelPosForGridPos(element.pos);

		this._chunks[CollisionFunctions.gridPosToChunk(element.pos.x)][CollisionFunctions.gridPosToChunk(element.pos.y)].addChild(sprite);

		const elemSprite = {element, sprite};
		this.allElements.set(element.id, elemSprite);

		this._viewInteractionManager.addEventListenersToNewElement(elemSprite);
	}

	private placeComponentInModel(position: PIXI.Point, elementTypeId: number): Element {
		return this.projectsService.allProjects.get(this.projectId).addElement(elementTypeId, position);
	}

	private applyActionsToView(actions: Action[]) {
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
				break;
			case 'remComp':
				this.allElements.get(action.element.id).sprite.destroy();
				this.allElements.delete(action.element.id);
				break;
			case 'remWire':
				break;
			case 'movComp':
			case 'movWire':
				break;
		}
	}

	public get projectId(): number {
		return this._projectId;
	}

	public destroy() {
		this._notificationsFromProjectServiceSubscription.unsubscribe();
		this._zoomPanInputManager.destroy();
		super.destroy({
			children: true
		});
	}

}
