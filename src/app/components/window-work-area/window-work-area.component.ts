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

@Component({
	selector: 'app-window-work-area',
	templateUrl: './window-work-area.component.html',
	styleUrls: ['./window-work-area.component.scss']
})
export class WindowWorkAreaComponent extends WorkArea implements OnInit, OnChanges, OnDestroy {

	constructor(
		private renderer2: Renderer2,
		private ngZone: NgZone
	) {
		super();
	}

	@Input()
	public project: Project;

	@Input()
	identifier: string;

	@Input()
	parentNames: string[];

	@Input()
	dragBounding: HTMLElement;

	@Input()
	showing: boolean;

	@Input()
	zIndex: number;

	@Output()
	onRequestHide = new EventEmitter<void>();

	@Output()
	requestOnTop = new EventEmitter<void>();

	@ViewChild('popup', {static: true})
	private _popup: ElementRef<HTMLDivElement>;

	@ViewChild('canvasContainer', {static: true})
	private _pixiCanvasContainer: ElementRef<HTMLDivElement>;

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
			if (changes.showing.currentValue) {
				this.show();
			} else {
				this.hide();
			}
		}
		if (changes.project && this.showing) {
			this.ngZone.run(() => {
				this._activeView = new SimulationView(
					this.project,
					this._pixiCanvasContainer.nativeElement,
					this._ticker,
					this.requestInspectElementInSim,
					this.identifier,
					this.parentNames
				);

				if (this._dragManager) this._dragManager.destroy();

				this._dragManager =  new WindowDragManager(
					this.dragBounding,
					this._pixiCanvasContainer.nativeElement,
					this._popup.nativeElement,
					this._header.nativeElement,
					this.renderer2,
					this._activeView as SimulationView,
					this._pixiRenderer
				);
			});
		}
	}

	public requestHide() {
		this.onRequestHide.emit();
	}

	public doRequestOnTop() {
		this.requestOnTop.next();
	}

	public hide() {
		this.renderer2.setStyle(this._popup.nativeElement, 'display', 'none');
		if (!this._dragManager) return;
		this._dragManager.destroy();
		delete this._dragManager;
	}

	public show() {
		this.renderer2.setStyle(this._popup.nativeElement, 'display', 'block');
		this._pixiRenderer.resize(this._pixiCanvasContainer.nativeElement.offsetWidth, this._pixiCanvasContainer.nativeElement.offsetHeight);
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
			typeId: Number(identifiers[identifiers.length - 1].split('-')[1]),
			parentNames: this.parentNames.splice(0, index)
		});
	}

	ngOnDestroy(): void {
		super.destroy();
		this._dragManager.destroy();
	}

}
