import {
	ChangeDetectorRef,
	Component,
	ElementRef,
	NgZone,
	OnDestroy,
	OnInit,
	Renderer2,
	ViewChild
} from '@angular/core';
import { EditorView } from '../../models/rendering/editor-view';
import { ProjectsService } from '../../services/projects/projects.service';
import { Project } from '../../models/project';
import { WorkArea } from '../../models/rendering/work-area';
import { takeUntil } from 'rxjs/operators';
import { WorkModeService } from '../../services/work-mode/work-mode.service';
import { SimulationView } from '../../models/rendering/simulation-view';
import { View } from '../../models/rendering/view';
import { WorkMode } from '../../models/work-modes';
import { EditorInteractionService } from '../../services/editor-interaction/editor-interaction.service';
import { EditorAction } from '../../models/editor-action';
import { ElementProviderService } from '../../services/element-provider/element-provider.service';
import { fromEvent } from 'rxjs';

@Component({
	selector: 'app-work-area',
	templateUrl: './work-area.component.html',
	styleUrls: ['./work-area.component.scss']
})
export class WorkAreaComponent extends WorkArea implements OnInit, OnDestroy {
	private _allViews: Map<number, EditorView>;

	private currentlyDragging: Project;
	private tabChildren: {
		element: HTMLElement;
		pos: number;
	}[];
	private dragStart: number;
	private dragElement: HTMLDivElement;

	@ViewChild('pixiCanvasContainer', { static: true })
	private _pixiCanvasContainer: ElementRef<HTMLDivElement>;

	@ViewChild('tabs', { static: true })
	private _tabsElement: ElementRef<HTMLDivElement>;

	constructor(
		private renderer2: Renderer2,
		private ngZone: NgZone,
		private projectsService: ProjectsService,
		private workMode: WorkModeService,
		private editorInteraction: EditorInteractionService,
		private elementProvider: ElementProviderService,
		private cdr: ChangeDetectorRef
	) {
		super();
	}

	ngOnInit() {
		this._allViews = new Map<number, EditorView>();

		this.ngZone.runOutsideAngular(() => {
			this.addTickerFunction();
			this.preventContextMenu(this._pixiCanvasContainer, this.renderer2);
			this.initZoomPan(this._pixiCanvasContainer);
			this.initPixi(this._pixiCanvasContainer, this.renderer2);

			this.projectsService.onProjectOpened$
				.pipe(takeUntil(this._destroySubject))
				.subscribe((projectId) => this.onProjectOpen(projectId));

			this.projectsService.onProjectClosed$
				.pipe(takeUntil(this._destroySubject))
				.subscribe((id) => this.onProjectClose(id));

			this.projectsService.onProjectSwitch$
				.pipe(takeUntil(this._destroySubject))
				.subscribe((id) => this.onProjectSwitch(id));

			this.projectsService.onUserDefinedElementsReload$
				.pipe(takeUntil(this._destroySubject))
				.subscribe(() => this.onUserElementsReload());

			this.editorInteraction
				.subscribeEditorAction(
					EditorAction.ZOOM_IN,
					EditorAction.ZOOM_OUT,
					EditorAction.ZOOM_100
				)
				.pipe(takeUntil(this._destroySubject))
				.subscribe((action) => this.activeView.onZoom(action));

			fromEvent(window, 'mouseup')
				.pipe(takeUntil(this._destroySubject))
				.subscribe(() => this.mouseUp());

			fromEvent(window, 'mousemove')
				.pipe(takeUntil(this._destroySubject))
				.subscribe((e: MouseEvent) => this.mouseMove(e));

			this.workMode.isSimulationMode$.subscribe((isSim) =>
				this.onSimulationModeChanged(isSim)
			);
		});
	}

	getIdentifier(): string {
		return '0';
	}

	mouseDown(project: Project, event: MouseEvent, tab: HTMLDivElement) {
		if (event.button !== 0) return;
		this.currentlyDragging = project;
		this.dragStart = event.clientX;
		this.dragElement = tab;
		this.dragElement.style.transitionDuration = '0s';
		this.tabChildren = [];
		for (const child of this._tabsElement.nativeElement
			.children as unknown as HTMLElement[]) {
			if (child === this.dragElement) continue;
			this.tabChildren.push({
				element: child,
				pos: child.offsetLeft
			});
			child.style.transitionDuration = '0.25s';
		}
		this.switchToProject(project.id);
	}

	mouseMove(e: MouseEvent) {
		if (this.currentlyDragging) {
			const offset = e.clientX - this.dragStart;
			this.dragElement.style.left = offset + 'px';

			if (this.dragElement.offsetLeft < 0) {
				this.dragElement.style.left =
					offset - this.dragElement.offsetLeft + 'px';
			} else if (
				this.dragElement.offsetLeft + this.dragElement.offsetWidth >
				this._tabsElement.nativeElement.offsetWidth
			) {
				this.dragElement.style.left =
					offset -
					(this.dragElement.offsetLeft +
						this.dragElement.offsetWidth -
						this._tabsElement.nativeElement.offsetWidth) +
					'px';
			}

			for (const child of this.tabChildren) {
				if (
					child.pos + child.element.offsetWidth / 2 <=
						this.dragElement.offsetLeft - offset &&
					child.pos + child.element.offsetWidth / 2 >
						this.dragElement.offsetLeft
				) {
					child.element.style.left = this.dragElement.offsetWidth + 8 + 'px';
				} else if (
					child.pos - child.element.offsetWidth / 2 >=
						this.dragElement.offsetLeft - offset &&
					child.pos - child.element.offsetWidth / 2 <
						this.dragElement.offsetLeft
				) {
					child.element.style.left = -this.dragElement.offsetWidth - 8 + 'px';
				} else {
					child.element.style.left = '0px';
				}
			}
		}
	}

	mouseUp() {
		if (this.currentlyDragging) {
			const sortedTabs = Array.from<HTMLElement>(
				this._tabsElement.nativeElement.children as unknown as HTMLElement[]
			).sort((x, y) => x.offsetLeft - y.offsetLeft);
			const dragTabIndex = sortedTabs.indexOf(this.dragElement);

			for (const child of this._tabsElement.nativeElement
				.children as unknown as HTMLElement[]) {
				child.style.left = '';
				child.style.transitionDuration = '0s';
			}

			this.projectsService.moveProjectToIndex(
				this.currentlyDragging,
				dragTabIndex
			);
			this.cdr.detectChanges();

			this.currentlyDragging = undefined;
		}
	}

	public get allProjects(): Project[] {
		return this.projectsService.allProjects;
	}

	public get isSimulationMode(): boolean {
		return this.workMode.currentWorkMode === WorkMode.SIMULATION;
	}

	public get activeView(): View {
		return this._activeView;
	}

	private onSimulationModeChanged(simulation: boolean) {
		if (simulation) {
			this._activeView = new SimulationView(
				this.projectsService.mainProject,
				this._pixiCanvasContainer.nativeElement,
				() => this.ticker.singleFrame('0'),
				this.requestInspectElementInSim,
				'0',
				[],
				[],
				this._activeView.zoomPan.zoomPanData
			);
			this.ticker.singleFrame('0');
		} else {
			if (!this._activeView) return;
			const editorView = this._allViews.get(this._activeView.project.id);
			editorView.zoomPan.setZoomPanData(this._activeView.zoomPan.zoomPanData);
			editorView.updateChunks();
			this._activeView.destroy();
			delete this._activeView;
			// @ts-expect-error workaround for something that I don't understand anymore
			this._pixiRenderer._lastObjectRendered = null;
			this.switchToProject(this.allProjects[0].id);
		}
		if (this._pixiRenderer) {
			this._pixiRenderer.resize(
				this._pixiCanvasContainer.nativeElement.offsetWidth,
				this._pixiCanvasContainer.nativeElement.offsetHeight
			);
		}
	}

	private onProjectOpen(projectId: number) {
		const newView = new EditorView(
			this.projectsService.getProjectById(projectId),
			this._pixiCanvasContainer.nativeElement,
			() => this.ticker.singleFrame('0')
		);
		this.ngZone.run(() => {
			this._allViews.set(projectId, newView);
			this._activeView = newView;
			this.projectsService.switchToProject(projectId);
		});
		this.ticker.singleFrame('0');
	}

	public switchToProject(toSwitchToId: number) {
		if (this.workMode.currentWorkMode === WorkMode.SIMULATION) return;
		this.projectsService.switchToProject(toSwitchToId);
	}

	private onProjectSwitch(id: number) {
		this._activeView = this._allViews.get(id);
		if (
			(this.activeView.project.type === 'project' &&
				this.elementProvider.isPlugElement(
					this.workMode.currentComponentToBuild
				)) ||
			this.activeView.project.id === this.workMode.currentComponentToBuild
		) {
			this.workMode.setWorkMode(WorkMode.SELECT);
		}
		this.ticker.singleFrame('0');
	}

	private onUserElementsReload() {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		for (const [_, view] of this._allViews) {
			view.updateSymbolUserDefinedElements();
		}
	}

	public tabCloseClicked(project: Project, event: MouseEvent) {
		if (!(event.button === 0 || event.button === 1)) return;
		event.stopPropagation();
		if (this._allViews.size <= 1 || project.type !== 'comp') return;
		this.projectsService.closeProject(project.id);
	}

	public onProjectClose(id: number) {
		const toClose = this._allViews.get(id);
		this._allViews.delete(id);
		if (toClose === this._activeView && this.allProjects.length > 0) {
			this.switchToProject(this.allProjects[0].id);
		}
		toClose.destroy();
		// @ts-expect-error workaround for something that I don't understand anymore
		this._pixiRenderer._lastObjectRendered = null;
	}

	ngOnDestroy(): void {
		super.destroy();
	}
}
