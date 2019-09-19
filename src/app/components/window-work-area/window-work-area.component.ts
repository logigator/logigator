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

	@ViewChild('popup', {static: true})
	private _popup: ElementRef<HTMLDivElement>;

	@ViewChild('canvasContainer', {static: true})
	private _pixiCanvasContainer: ElementRef<HTMLDivElement>;

	@ViewChild('header', {static: true})
	private _header: ElementRef<HTMLDivElement>;

	private _view: View;

	public componentName: string;

	private _currentlyDragging: 'move' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'right' | 'left' | 'top' | 'bottom';

	private _bounding: HTMLElement;

	constructor(
		private renderer2: Renderer2,
		private ngZone: NgZone,
		private elemProvider: ElementProviderService,
		private projects: ProjectsService
	) {
		super();
	}

	ngOnInit() {
		this._bounding = this.dragBoundingContainer instanceof ElementRef ? this.dragBoundingContainer.nativeElement : this.dragBoundingContainer;
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

			fromEvent(this._popup.nativeElement, 'mousedown').pipe(
				takeUntil(this._destroySubject)
			).subscribe((e: MouseEvent) => this.mouseDown(e));
		});
	}

	private openProject(projectId: number) {
		this._view = new View(projectId, this._pixiCanvasContainer.nativeElement);
		this.componentName = this.projects.allProjects.get(projectId).id.toString();
	}

	public mouseMove(event: MouseEvent) {
		if (this._currentlyDragging) {
			const changeX = event.movementX / window.devicePixelRatio;
			const changeY = event.movementY / window.devicePixelRatio;
			const newX = this._popup.nativeElement.offsetLeft + event.movementX / window.devicePixelRatio;
			const newY = this._popup.nativeElement.offsetTop + event.movementY / window.devicePixelRatio;

			switch (this._currentlyDragging) {
				case 'move':
					if (!this.collision_left(newX) && !this.collision_right(newX))
						this.renderer2.setStyle(this._popup.nativeElement, 'left', newX + 'px');
					if (!this.collision_bottom(newY) && !this.collision_top(newY))
						this.renderer2.setStyle(this._popup.nativeElement, 'top', newY + 'px');
					break;
				case 'top-left':
					if (!this.collision_top(newY, changeY)) {
						this.renderer2.setStyle(this._popup.nativeElement, 'top', newY + 'px');
						this.renderer2.setStyle(this._popup.nativeElement, 'height', this._popup.nativeElement.offsetHeight - changeY + 'px');
					}
					if (!this.collision_left(newX, changeX)) {
						this.renderer2.setStyle(this._popup.nativeElement, 'left', newX + 'px');
						this.renderer2.setStyle(this._popup.nativeElement, 'width', this._popup.nativeElement.offsetWidth - changeX + 'px');
					}
					this._pixiRenderer.resize(this._pixiCanvasContainer.nativeElement.offsetWidth, this._pixiCanvasContainer.nativeElement.offsetHeight);
					break;
				case 'top-right':
					if (!this.collision_top(newY, changeY)) {
						this.renderer2.setStyle(this._popup.nativeElement, 'top', newY + 'px');
						this.renderer2.setStyle(this._popup.nativeElement, 'height', this._popup.nativeElement.offsetHeight - changeY + 'px');
					}
					if (!this.collision_right(newX, changeX)) {
						this.renderer2.setStyle(this._popup.nativeElement, 'width', this._popup.nativeElement.offsetWidth + changeX + 'px');
					}
					this._pixiRenderer.resize(this._pixiCanvasContainer.nativeElement.offsetWidth, this._pixiCanvasContainer.nativeElement.offsetHeight);
					break;
				case 'bottom-left':
					if (!this.collision_bottom(newY, changeY)) {
						this.renderer2.setStyle(this._popup.nativeElement, 'height', this._popup.nativeElement.offsetHeight + changeY + 'px');
					}
					if (!this.collision_left(newX, changeX)) {
						this.renderer2.setStyle(this._popup.nativeElement, 'left', newX + 'px');
						this.renderer2.setStyle(this._popup.nativeElement, 'width', this._popup.nativeElement.offsetWidth - changeX + 'px');
					}
					this._pixiRenderer.resize(this._pixiCanvasContainer.nativeElement.offsetWidth, this._pixiCanvasContainer.nativeElement.offsetHeight);
					break;
				case 'bottom-right':
					if (!this.collision_bottom(newY, changeY)) {
						this.renderer2.setStyle(this._popup.nativeElement, 'height', this._popup.nativeElement.offsetHeight + changeY + 'px');
					}
					if (!this.collision_right(newX, changeX)) {
						this.renderer2.setStyle(this._popup.nativeElement, 'width', this._popup.nativeElement.offsetWidth + changeX + 'px');
					}
					this._pixiRenderer.resize(this._pixiCanvasContainer.nativeElement.offsetWidth, this._pixiCanvasContainer.nativeElement.offsetHeight);
					break;
				case 'top':
					if (!this.collision_top(newY, changeY)) {
						this.renderer2.setStyle(this._popup.nativeElement, 'top', newY + 'px');
						this.renderer2.setStyle(this._popup.nativeElement, 'height', this._popup.nativeElement.offsetHeight - changeY + 'px');
						this._pixiRenderer.resize(this._pixiCanvasContainer.nativeElement.offsetWidth, this._pixiCanvasContainer.nativeElement.offsetHeight);
					}
					break;
				case 'right':
					if (!this.collision_right(newX, changeX)) {
						this.renderer2.setStyle(this._popup.nativeElement, 'width', this._popup.nativeElement.offsetWidth + changeX + 'px');
						this._pixiRenderer.resize(this._pixiCanvasContainer.nativeElement.offsetWidth, this._pixiCanvasContainer.nativeElement.offsetHeight);
					}
					break;
				case 'bottom':
					if (!this.collision_bottom(newY, changeY)) {
						this.renderer2.setStyle(this._popup.nativeElement, 'height', this._popup.nativeElement.offsetHeight + changeY + 'px');
						this._pixiRenderer.resize(this._pixiCanvasContainer.nativeElement.offsetWidth, this._pixiCanvasContainer.nativeElement.offsetHeight);
					}
					break;
				case 'left':
					if (!this.collision_left(newX, changeX)) {
						this.renderer2.setStyle(this._popup.nativeElement, 'left', newX + 'px');
						this.renderer2.setStyle(this._popup.nativeElement, 'width', this._popup.nativeElement.offsetWidth - changeX + 'px');
						this._pixiRenderer.resize(this._pixiCanvasContainer.nativeElement.offsetWidth, this._pixiCanvasContainer.nativeElement.offsetHeight);
					}
					break;
			}
		}
	}

	private collision_left(newX: number, changeX?: number): boolean {
		return newX <= this._bounding.offsetLeft || (changeX && this._popup.nativeElement.offsetWidth - changeX <= 100);
	}

	private collision_right(newX: number, changeX?: number): boolean {
		return newX + this._popup.nativeElement.offsetWidth >= this._bounding.offsetLeft + this._bounding.offsetWidth
			|| (changeX && this._popup.nativeElement.offsetWidth + changeX <= 100);
	}

	private collision_top(newY: number, changeY?: number): boolean {
		return newY <= this._bounding.offsetTop || (changeY && this._popup.nativeElement.offsetHeight - changeY <= 100);
	}

	private collision_bottom(newY: number, changeY?: number): boolean {
		return newY + this._popup.nativeElement.offsetHeight >= this._bounding.offsetTop + this._bounding.offsetHeight
			|| (changeY && this._popup.nativeElement.offsetHeight + changeY <= 100);
	}

	public mouseDown(event: MouseEvent) {
		const borderWidth = 2;

		if (event.button !== 0)
			return;

		if (event.offsetX >= 0 && event.offsetX <= borderWidth) {
			if (event.offsetY >= 0 && event.offsetY <= borderWidth) {
				// top-left
				console.log('top-left');
				this._currentlyDragging = 'top-left';
			} else if (event.offsetY >= this._popup.nativeElement.offsetHeight - borderWidth
					&& event.offsetY <= this._popup.nativeElement.offsetHeight) {
				// bottom-left
				console.log('bottom-left');
				this._currentlyDragging = 'bottom-left';
			} else {
				// left
				console.log('left');
				this._currentlyDragging = 'left';
			}
		} else if (event.offsetY >= 0 && event.offsetY <= borderWidth) {
			if (event.offsetX >= this._popup.nativeElement.offsetWidth - borderWidth
					&& event.offsetX <= this._popup.nativeElement.offsetWidth) {
				// top-right
				console.log('top-right');
				this._currentlyDragging = 'top-right';
			} else {
				// top
				console.log('top');
				this._currentlyDragging = 'top';
			}
		} else if (event.offsetY >= this._popup.nativeElement.offsetHeight - borderWidth
				&& event.offsetY <= this._popup.nativeElement.offsetHeight) {
			if (event.offsetX >= this._popup.nativeElement.offsetWidth - borderWidth
					&& event.offsetX <= this._popup.nativeElement.offsetWidth) {
				// bottom-right
				console.log('bottom-right');
				this._currentlyDragging = 'bottom-right';
			} else {
				// bottom
				console.log('bottom');
				this._currentlyDragging = 'bottom';
			}
		} else if (event.offsetX >= this._popup.nativeElement.offsetWidth - borderWidth
				&& event.offsetX <= this._popup.nativeElement.offsetWidth) {
			// right
			console.log('right');
			this._currentlyDragging = 'right';
		} else if (event.target === this._header.nativeElement) {
			console.log('move');
			this._currentlyDragging = 'move';
		}
	}

	public mouseUp(event: MouseEvent) {
		this._currentlyDragging = undefined;
	}

	public hide() {
		this.renderer2.setStyle(this._popup.nativeElement, 'display', 'none');
		this._pixiTicker.stop();
	}

	public show() {
		this.renderer2.setStyle(this._popup.nativeElement, 'display', 'block');
		this._pixiRenderer.resize(this._pixiCanvasContainer.nativeElement.offsetWidth, this._pixiCanvasContainer.nativeElement.offsetHeight);
		this._pixiTicker.start();
	}

	ngOnDestroy(): void {
		super.destroy();
	}

}
