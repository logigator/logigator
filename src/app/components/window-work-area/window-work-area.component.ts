import {
	Component,
	ElementRef,
	Input,
	NgZone,
	OnDestroy,
	OnInit,
	Renderer2,
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
export class WindowWorkAreaComponent extends WorkArea implements OnInit, OnDestroy {

	constructor(
		private renderer2: Renderer2,
		private ngZone: NgZone
	) {
		super();
	}

	@Input()
	public project: Project;

	@Input()
	dragBounding: HTMLElement;

	@ViewChild('popup', {static: true})
	private _popup: ElementRef<HTMLDivElement>;

	@ViewChild('canvasContainer', {static: true})
	private _pixiCanvasContainer: ElementRef<HTMLDivElement>;

	@ViewChild('header', {static: true})
	private _header: ElementRef<HTMLDivElement>;

	private _dragManager: WindowDragManager;

	ngOnInit() {
		this._activeView = new SimulationView(
			this.project,
			this._pixiCanvasContainer.nativeElement,
			this._ticker,
			this.requestInspectElementInSim,
			'');

		this.ngZone.runOutsideAngular(async () => {
			this.preventContextMenu(this._pixiCanvasContainer, this.renderer2);
			this.initZoomPan(this._pixiCanvasContainer);
			this.initPixi(this._pixiCanvasContainer, this.renderer2);

			this._dragManager = new WindowDragManager(
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

	public hide() {
		this.renderer2.setStyle(this._popup.nativeElement, 'display', 'none');
	}

	public show() {
		this.renderer2.setStyle(this._popup.nativeElement, 'display', 'block');
		this._pixiRenderer.resize(this._pixiCanvasContainer.nativeElement.offsetWidth, this._pixiCanvasContainer.nativeElement.offsetHeight);
	}

	ngOnDestroy(): void {
		super.destroy();
		this._dragManager.destroy();
	}

}
