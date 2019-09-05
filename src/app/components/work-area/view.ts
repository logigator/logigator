import * as PIXI from 'pixi.js';
import {ZoomPanInputManager} from './zoom-pan-input-manager';
import {ZoomPan} from './zoom-pan';
import {Grid} from './grid';
import InteractionEvent = PIXI.interaction.InteractionEvent;
import {ComponentSprite} from '../../models/component-sprite';
import {ProjectsService} from '../../services/projects/projects.service';
import {ComponentProviderService} from '../../services/component-provider/component-provider.service';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {Component} from '../../models/component';
import {ViewInteractionManager} from './view-interaction-manager';

export class View extends PIXI.Container {

	private readonly _projectId: number;

	private _zoomPan: ZoomPan;

	private _zoomPanInputManager: ZoomPanInputManager;

	private _viewInteractionManager: ViewInteractionManager;

	private readonly _htmlContainer: HTMLElement;

	private readonly _projectsService: ProjectsService;

	private readonly _componentProviderService: ComponentProviderService;

	public readonly workModeService: WorkModeService;

	private _chunks: PIXI.ParticleContainer[][];

	private _allComponents: Map<number, ComponentSprite> = new Map();

	private grid: PIXI.Graphics;

	constructor(
		projectId: number,
		htmlContainer: HTMLElement,
		projectsService: ProjectsService,
		compProviderService: ComponentProviderService,
		workModeService: WorkModeService
	) {
		super();
		this._projectId = projectId;
		this._htmlContainer = htmlContainer;
		this._projectsService = projectsService;
		this._componentProviderService = compProviderService;
		this.workModeService = workModeService;
		this.interactive = true;

		this._zoomPan = new ZoomPan(this);
		this._zoomPanInputManager = new ZoomPanInputManager(this._htmlContainer);
		this._viewInteractionManager = new ViewInteractionManager(this);

		this.grid = Grid.generateGridGraphics(this._zoomPan.currentScale);
		this.addChild(this.grid);
		this.updateChunks();

	}

	public static createEmptyView(
		projectId: number,
		htmlContainer: HTMLElement,
		projectsService: ProjectsService,
		compProviderService: ComponentProviderService,
		workModeService: WorkModeService
	): View {
		return new View(projectId, htmlContainer, projectsService, compProviderService, workModeService);
	}

	private updateChunks() {
		let currentlyOnScreen = this._zoomPan.isOnScreen(this._htmlContainer.offsetHeight, this._htmlContainer.offsetWidth);
		currentlyOnScreen = {
			start: Grid.getGridPosForPixelPos(currentlyOnScreen.start),
			end: Grid.getGridPosForPixelPos(currentlyOnScreen.end)
		};
		// TODO: show / hide chunks, notify projects Service
	}

	public updateZoomPan() {
		let needsChunkUpdate = false;
		let needsGridGraphicsUpdate = false;
		if (this._zoomPanInputManager.isDragging) {
			needsChunkUpdate = this._zoomPan.translateBy(this._zoomPanInputManager.mouseDX, this._zoomPanInputManager.mouseDY) || needsChunkUpdate;
			this._zoomPanInputManager.clearMouseDelta();
		}

		if (this._zoomPanInputManager.isZoomIn) {
			needsGridGraphicsUpdate = this._zoomPan.zoomBy(0.75, this._zoomPanInputManager.mouseX, this._zoomPanInputManager.mouseY);
			needsChunkUpdate = needsGridGraphicsUpdate || needsGridGraphicsUpdate;
		} else if (this._zoomPanInputManager.isZoomOut) {
			needsGridGraphicsUpdate = this._zoomPan.zoomBy(1.25, this._zoomPanInputManager.mouseX, this._zoomPanInputManager.mouseY);
			needsChunkUpdate = needsGridGraphicsUpdate || needsGridGraphicsUpdate;
		}

		if (needsChunkUpdate) {
			this.updateChunks();
			if (needsGridGraphicsUpdate) {
				this.updateGridGraphics();
			}
		}
	}

	private updateGridGraphics() {
		this.grid.destroy();
		this.grid = Grid.generateGridGraphics(this._zoomPan.currentScale);
		this.addChild(this.grid);
	}

	public placeComponent(point: PIXI.Point) {
		const compType = this._componentProviderService.getComponentById(this.workModeService.currentComponentToBuild);
		if (!compType.texture) {
			this._componentProviderService.generateTextureForComponent(this.workModeService.currentComponentToBuild);
		}
		const sprite = new PIXI.Sprite(compType.texture);
		// TODO: notify projectsService, ask for chunk + calculate pos on chunk

		sprite.position = Grid.getPixelPosForGridPos(point);
		this.addChild(sprite);

		const comp = this.addComponentTest(this.workModeService.currentComponentToBuild, point);
		const compSprite = {component: comp, sprite};
		this._allComponents.set(comp.id, compSprite);

		this.addListenersToNewComponent(compSprite);
	}

	private addListenersToNewComponent(compSprite: ComponentSprite) {
		compSprite.sprite.interactive = true;
		compSprite.sprite.on('click', (e: InteractionEvent) => {
			if (this.workModeService.currentWorkMode === 'select') {
				// TODO: select component
			} else {
				e.stopPropagation();
			}
		});
		// compSprite.sprite.on('pointerdown', () => this._currentlyDraggingComponent = compSprite.component.id);
		// compSprite.sprite.on('pointerup', (e: InteractionEvent) => this.componentDragEnd(e));
		// compSprite.sprite.on('pointerupoutside', (e: InteractionEvent) => this.componentDragEnd(e));
	}

	public get projectId(): number {
		return this._projectId;
	}

	// just for testing, until project-service works
	private id = 0;
	private addComponentTest(type: number, pos: PIXI.Point): Component {
		return {
			id: ++this.id,
			typeId: type,
			posX: pos.x,
			posY: pos.y,
			outputs: [],
			inputs: [],
			name: ''
		};
	}

	public destroy() {
		this._zoomPanInputManager.destroy();
		super.destroy({
			children: true
		});
	}

}
