import {
	Component,
	ElementRef, EventEmitter,
	Input,
	NgZone, OnChanges,
	OnDestroy,
	OnInit, Output,
	Renderer2, SimpleChanges,
	ViewChild
} from '@angular/core';
import {WorkArea} from '../../models/rendering/work-area';
import {Project} from '../../models/project';
import {SimulationView} from '../../models/rendering/simulation-view';
import {WindowDragManager} from './window-drag-manager';
import {ThemingService} from '../../services/theming/theming.service';
import {Theme} from '../../models/theming';
import {ComponentInspectable} from '../../models/rendering/graphics/l-graphics';

@Component({
	selector: 'app-window-work-area',
	templateUrl: './window-work-area.component.html',
	styleUrls: ['./window-work-area.component.scss']
})
export class WindowWorkAreaComponent extends WorkArea implements OnInit, OnChanges, OnDestroy {

	constructor(
		private renderer2: Renderer2,
		private ngZone: NgZone,
		private themingService: ThemingService
	) {
		super();
	}

	@Input()
	public project: Project;

	@Input()
	public sprite: ComponentInspectable;

	@Input()
	public projectChange: number;

	@Input()
	identifier: string;

	@Input()
	parentNames: string[];

	@Input()
	parentTypeIds: number[];

	@Input()
	dragBounding: HTMLElement;

	@Input()
	showing: boolean;

	@Input()
	zIndex: number;

	@Output()
	requestHide = new EventEmitter<void>();

	@Output()
	requestOnTop = new EventEmitter<void>();

	@ViewChild('popup', {static: true})
	private _popup: ElementRef<HTMLDivElement>;

	@ViewChild('canvasContainer', {static: true})
	private _pixiCanvasContainer: ElementRef<HTMLDivElement>;

	@ViewChild('componentContainer', {static: true})
	private _componentContainer: ElementRef<HTMLDivElement>;

	@ViewChild('header', {static: true})
	private _header: ElementRef<HTMLDivElement>;

	private _dragManager: WindowDragManager;

	ngOnInit() {
		this.ngZone.runOutsideAngular(async () => {
			this.preventContextMenu(this._pixiCanvasContainer, this.renderer2);
			this.initZoomPan(this._pixiCanvasContainer);
			this.initPixi(this._pixiCanvasContainer, this.renderer2);
		});
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes.showing) {
			if (this.showing) {
				this.show();
			} else {
				this.hide();
				if (this._dragManager) this._dragManager.destroy();
			}
		}
		if (changes.identifier && this.showing) {
			this.ticker.removeTickerFunction(changes.identifier.previousValue);
			if (this._activeView) {
				this._activeView.destroy();
				// @ts-ignore
				this._pixiRenderer._lastObjectRendered = null;
			}

			if (this.project) {
				this._componentContainer.nativeElement.style.display = 'none';
				this._pixiCanvasContainer.nativeElement.style.display = 'block';
				this.addTickerFunction();

				this._activeView = new SimulationView(
					this.project,
					this._pixiCanvasContainer.nativeElement,
					() => this.ticker.singleFrame(this.identifier),
					this.requestInspectElementInSim,
					this.identifier,
					this.parentNames,
					this.parentTypeIds
				);
				this._activeView.centerView();

				if (this._dragManager) this._dragManager.destroy();

				this._dragManager = new WindowDragManager(
					this.dragBounding,
					this._pixiCanvasContainer.nativeElement,
					this._popup.nativeElement,
					this._header.nativeElement,
					this.renderer2
				);

				this._dragManager.onChange$.subscribe(() => {
					this._pixiRenderer.resize(this._pixiCanvasContainer.nativeElement.offsetWidth, this._pixiCanvasContainer.nativeElement.offsetHeight);
					this._activeView.updateChunks();
					this._activeView.requestSingleFrame();
				});
			} else if (this.sprite) {
				this._componentContainer.nativeElement.style.display = 'block';
				this._pixiCanvasContainer.nativeElement.style.display = 'none';

				// max dimensions for sprite?
				this._dragManager = new WindowDragManager(
					this.dragBounding,
					this._componentContainer.nativeElement,
					this._popup.nativeElement,
					this._header.nativeElement,
					this.renderer2
				);
			}
		}
	}

	getIdentifier(): string {
		return this.identifier;
	}

	public get theme(): Theme {
		return this.themingService.currentTheme;
	}

	public doRequestHide() {
		this.requestHide.emit();
	}

	public doRequestOnTop() {
		this.requestOnTop.next();
	}

	public hide() {
		this.ticker.removeTickerFunction(this.identifier);
		this.renderer2.setStyle(this._popup.nativeElement, 'display', 'none');
		if (this._dragManager) {
			this._dragManager.destroy();
			delete this._dragManager;
		}
		if (this._activeView) {
			this._activeView.destroy();
			delete this._activeView;
			// @ts-ignore
			this._pixiRenderer._lastObjectRendered = null;
		}
	}

	public show() {
		if (this.project) {
			this.renderer2.setStyle(this._popup.nativeElement, 'display', 'block');
			this._pixiRenderer.resize(this._pixiCanvasContainer.nativeElement.offsetWidth, this._pixiCanvasContainer.nativeElement.offsetHeight);
		} else if (this.sprite) {

		}
	}

	public get headerNames(): string[] {
		if (!this.parentNames || !this.project) return [];
		return [...this.parentNames, this.project.name];
	}

	public inspectParentElement(index: number) {
		if ((this.headerNames.length - 1) === index) return;
		const identifiers = this.identifier.split(':').slice(0, 2 + index);
		this.requestInspectElementInSim.emit({
			identifier: identifiers.join(':'),
			typeId: this.parentTypeIds[index],
			parentNames: this.parentNames.splice(0, index),
			parentTypeIds: this.parentTypeIds.slice(0, index)
		});
	}

	ngOnDestroy(): void {
		this._dragManager.destroy();
		super.destroy();
	}

}
