import {
	Component,
	ComponentFactoryResolver,
	ComponentRef,
	ElementRef,
	EventEmitter,
	Input,
	NgZone,
	OnChanges,
	OnInit,
	Output,
	Renderer2,
	SimpleChanges,
	ViewChild,
	ViewContainerRef
} from '@angular/core';
import {WorkArea} from '../../models/rendering/work-area';
import {Project} from '../../models/project';
import {SimulationView} from '../../models/rendering/simulation-view';
import {WindowDragManager} from './window-drag-manager';
import {ThemingService} from '../../services/theming/theming.service';
import {Theme} from '../../models/theming';
import {ComponentInspectable} from '../../models/rendering/graphics/l-graphics';
import {ElementProviderService} from '../../services/element-provider/element-provider.service';
import {ElementInspectionComp} from '../element-inspection/element-inspection-comp';
import {TranslateService} from '@ngx-translate/core';
import * as PIXI from 'pixi.js';

@Component({
	selector: 'app-window-work-area',
	templateUrl: './window-work-area.component.html',
	styleUrls: ['./window-work-area.component.scss']
})
export class WindowWorkAreaComponent extends WorkArea implements OnInit, OnChanges {

	constructor(
		private renderer2: Renderer2,
		private ngZone: NgZone,
		private themingService: ThemingService,
		private elementProvider: ElementProviderService,
		private componentFactoryResolver: ComponentFactoryResolver,
		private translate: TranslateService
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

	@ViewChild('componentInsertionPoint', {read: ViewContainerRef, static: true})
	private _componentInsertionPoint: ViewContainerRef;

	@ViewChild('header', {static: true})
	private _header: ElementRef<HTMLDivElement>;

	private _dragManager: WindowDragManager;

	private _componentRef: ComponentRef<ElementInspectionComp>;

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
			}
		}
		if (changes.identifier) {
			this.ticker.removeTickerFunction(changes.identifier.previousValue);
		}
		if (changes.identifier && this.showing) {
			if (this._activeView) {
				this._activeView.destroy();
				delete this._activeView;
				// @ts-ignore
				this._pixiRenderer._lastObjectRendered = null;
			}
			if (this._componentRef) {
				this._componentRef.destroy();
				delete this._componentRef;
			}

			if (this.project) {
				this.renderer2.setStyle(this._componentContainer.nativeElement, 'display', 'none');
				this.renderer2.setStyle(this._pixiCanvasContainer.nativeElement, 'display', 'block');
				this._pixiRenderer.resize(this._pixiCanvasContainer.nativeElement.offsetWidth, this._pixiCanvasContainer.nativeElement.offsetHeight);
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
				this.renderer2.setStyle(this._componentContainer.nativeElement, 'display', 'block');
				this.renderer2.setStyle(this._pixiCanvasContainer.nativeElement, 'display', 'none');

				const inspectionComponentType = this.elementProvider.getElementById(this.sprite.element.typeId).elementInspectionComp;
				const inspectionComponentFactory = this.componentFactoryResolver.resolveComponentFactory(inspectionComponentType);
				this._componentRef = this._componentInsertionPoint.createComponent(inspectionComponentFactory);
				this._componentRef.instance.sprite = this.sprite;

				if (this._dragManager) this._dragManager.destroy();

				this.renderer2.setStyle(this._popup.nativeElement, 'width', '630px');
				this.renderer2.setStyle(this._popup.nativeElement, 'height', '500px');
				this._dragManager = new WindowDragManager(
					this.dragBounding,
					this._popup.nativeElement,
					this._header.nativeElement,
					this.renderer2,
					new PIXI.Point(630, 200),
					new PIXI.Point(630, 1000)
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

	private hide() {
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
		if (this._componentRef) {
			this._componentRef.destroy();
			delete this._componentRef;
		}
	}

	private show() {
		this.renderer2.setStyle(this._popup.nativeElement, 'display', 'block');
		if (this.project) {
			this._pixiRenderer.resize(this._pixiCanvasContainer.nativeElement.offsetWidth, this._pixiCanvasContainer.nativeElement.offsetHeight);
		}
	}

	public get headerNames(): string[] {
		if (!this.parentNames) return [];

		let name: string;
		if (this.project) {
			name = this.project.name;
		} else {
			name = this.translate.instant(this.elementProvider.getElementById(this.sprite.element.typeId).name);
		}

		return [...this.parentNames, name];
	}

	public inspectParentElement(index: number) {
		if (this.parentNames.length === index) return;
		const identifiers = this.identifier.split(':').slice(0, 2 + index);
		this.requestInspectElementInSim.emit({
			identifier: identifiers.join(':'),
			typeId: this.parentTypeIds[index],
			parentNames: this.parentNames.splice(0, index),
			parentTypeIds: this.parentTypeIds.slice(0, index)
		});
	}

}
