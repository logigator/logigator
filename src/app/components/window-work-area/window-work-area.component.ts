import {
	Component,
	ElementRef,
	EventEmitter,
	Input,
	NgZone,
	OnDestroy,
	OnInit,
	Output,
	Renderer2,
	ViewChild
} from '@angular/core';
import {View} from '../../models/rendering/view';
import {WorkArea} from '../../models/rendering/work-area';
import {fromEvent} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {ElementProviderService} from '../../services/element-provider/element-provider.service';
import {ProjectsService} from '../../services/projects/projects.service';

@Component({
	selector: 'app-window-work-area',
	templateUrl: './window-work-area.component.html',
	styleUrls: ['./window-work-area.component.scss']
})
export class WindowWorkAreaComponent extends WorkArea implements OnInit, OnDestroy {

	@Input()
	projectIdToOpen: number;

	@Input()
	dragBoundingContainer: HTMLElement | ElementRef<HTMLElement>;

	@Output()
	public requestClose: EventEmitter<any> = new EventEmitter();

	@ViewChild('popup', {static: true})
	private _popup: ElementRef<HTMLDivElement>;

	@ViewChild('canvasContainer', {static: true})
	private _pixiCanvasContainer: ElementRef<HTMLDivElement>;

	private _view: View;

	public componentName: string;

	private _currentlyDragging = false;

	constructor(
		private renderer2: Renderer2,
		private ngZone: NgZone,
		private elemProvider: ElementProviderService,
		private projects: ProjectsService
	) {
		super();
	}

	ngOnInit() {
		this.ngZone.runOutsideAngular(async () => {
			this.preventContextMenu(this._pixiCanvasContainer, this.renderer2);
			this.initPixi(this._pixiCanvasContainer, this.renderer2);
			this.initPixiTicker(() => {
				this._view.updateZoomPan();
				this._pixiRenderer.render(this._view);
			});
			this.openProject(this.projectIdToOpen);

			fromEvent(window, 'mousemove').pipe(
				takeUntil(this._destroySubject)
			).subscribe((e: MouseEvent) => this.mouseMove(e));

			fromEvent(window, 'mouseup').pipe(
				takeUntil(this._destroySubject)
			).subscribe((e: MouseEvent) => this.mouseUp(e));
		});
	}

	private openProject(projectId: number) {
		this._view = new View(projectId, this._pixiCanvasContainer.nativeElement);
		this.componentName = this.projects.allProjects.get(projectId).id.toString();
		this._pixiTicker.start();
	}

	public mouseDownHeader(event: MouseEvent) {
		if (event.button === 0) {
			this._currentlyDragging = true;
		}
	}

	public mouseMove(event: MouseEvent) {
		if (this._currentlyDragging) {
			let bounding: HTMLElement;
			if (this.dragBoundingContainer instanceof ElementRef) {
				bounding = this.dragBoundingContainer.nativeElement;
			} else {
				bounding = this.dragBoundingContainer;
			}

			const newX = this._popup.nativeElement.offsetLeft + event.movementX;
			const newY = this._popup.nativeElement.offsetTop + event.movementY;

			if (newX > bounding.offsetLeft && newX + this._popup.nativeElement.offsetWidth < bounding.offsetLeft + bounding.offsetWidth) {

				this.renderer2.setStyle(this._popup.nativeElement, 'left', newX + 'px');
			}
			if (newY > bounding.offsetTop  && newY + this._popup.nativeElement.offsetHeight < bounding.offsetTop + bounding.offsetHeight) {
				this.renderer2.setStyle(this._popup.nativeElement, 'top', newY + 'px');
			}
		}
	}

	public mouseUp(event: MouseEvent) {
		this._currentlyDragging = false;
	}

	private close() {
		this.requestClose.emit();
	}

	ngOnDestroy(): void {
		super.destroy();
	}

}
