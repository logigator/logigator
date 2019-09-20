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

type Border = 'move' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'right' | 'left' | 'top' | 'bottom';

@Component({
	selector: 'app-window-work-area',
	templateUrl: './window-work-area.component.html',
	styleUrls: ['./window-work-area.component.scss']
})
export class WindowWorkAreaComponent extends WorkArea implements OnInit, OnDestroy {

	constructor(
		private renderer2: Renderer2,
		private ngZone: NgZone,
		private elemProvider: ElementProviderService,
		private projects: ProjectsService
	) {
		super();
	}

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

	private _currentlyDragging: Border;
	private _draggingPos = [0, 0];

	private _bounding: HTMLElement;

	private static getBoarderCollision(offsetX: number, offsetY: number, element: HTMLElement, borderWidth: number = 7): Border {
		if (offsetX >= 0 && offsetX <= borderWidth) {
			if (offsetY >= 0 && offsetY <= borderWidth) {
				return 'top-left';
			} else if (offsetY >= element.offsetHeight - borderWidth
				&& offsetY <= element.offsetHeight) {
				return 'bottom-left';
			} else {
				return 'left';
			}
		} else if (offsetY >= 0 && offsetY <= borderWidth) {
			if (offsetX >= element.offsetWidth - borderWidth
				&& offsetX <= element.offsetWidth) {
				return 'top-right';
			} else {
				return 'top';
			}
		} else if (offsetY >= element.offsetHeight - borderWidth
			&& offsetY <= element.offsetHeight) {
			if (offsetX >= element.offsetWidth - borderWidth
				&& offsetX <= element.offsetWidth) {
				return 'bottom-right';
			} else {
				return 'bottom';
			}
		} else if (offsetX >= element.offsetWidth - borderWidth
			&& offsetX <= element.offsetWidth) {
			return 'right';
		} else {
			return null;
		}
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

			fromEvent(this._popup.nativeElement, 'mousemove').pipe(
				takeUntil(this._destroySubject)
			).subscribe((e: MouseEvent) => this.pointerOver(e));

			fromEvent(window, 'resize').pipe(
				takeUntil(this._destroySubject)
			).subscribe((e: MouseEvent) => {
				if (this.collision_right(this._popup.nativeElement.offsetLeft)) {
					let newLoc = (this._bounding.offsetLeft + this._bounding.offsetWidth) - this._popup.nativeElement.offsetWidth;
					if (this.collision_left(newLoc))
						newLoc = this._bounding.offsetLeft;
					this.renderer2.setStyle(this._popup.nativeElement, 'left', newLoc + 'px');
				}
				if (this.collision_bottom(this._popup.nativeElement.offsetTop)) {
					let newLoc = (this._bounding.offsetTop + this._bounding.offsetHeight) - this._popup.nativeElement.offsetHeight;
					if (this.collision_top(newLoc))
						newLoc = this._bounding.offsetTop;
					this.renderer2.setStyle(this._popup.nativeElement, 'top', newLoc + 'px');
				}
			});
		});
	}

	private openProject(projectId: number) {
		this._view = new View(projectId, this._pixiCanvasContainer.nativeElement);
		this.componentName = this.projects.allProjects.get(projectId).id.toString();
	}

	private pointerOver(event: MouseEvent) {
		if (this._currentlyDragging)
			return;

		if (event.target === this._header.nativeElement) {
			this.renderer2.setStyle(this._popup.nativeElement, 'cursor', 'move');
			return;
		}

		switch (WindowWorkAreaComponent.getBoarderCollision(event.layerX, event.layerY, this._popup.nativeElement)) {
			case 'top':
				this.renderer2.setStyle(this._popup.nativeElement, 'cursor', 'n-resize');
				break;
			case 'right':
				this.renderer2.setStyle(this._popup.nativeElement, 'cursor', 'e-resize');
				break;
			case 'bottom':
				this.renderer2.setStyle(this._popup.nativeElement, 'cursor', 's-resize');
				break;
			case 'left':
				this.renderer2.setStyle(this._popup.nativeElement, 'cursor', 'w-resize');
				break;
			case 'bottom-left':
				this.renderer2.setStyle(this._popup.nativeElement, 'cursor', 'sw-resize');
				break;
			case 'bottom-right':
				this.renderer2.setStyle(this._popup.nativeElement, 'cursor', 'se-resize');
				this._popup.nativeElement.style.cursor = 'se-resize';
				break;
			case 'top-left':
				this.renderer2.setStyle(this._popup.nativeElement, 'cursor', 'nw-resize');
				break;
			case 'top-right':
				this.renderer2.setStyle(this._popup.nativeElement, 'cursor', 'ne-resize');
				break;
		}
	}

	private mouseMove(event: MouseEvent) {
		if (this._currentlyDragging) {
			const changeX = event.screenX - this._draggingPos[0];
			const changeY = event.screenY - this._draggingPos[1];
			this._draggingPos = [ event.screenX, event.screenY ];

			const newX = this._popup.nativeElement.offsetLeft + changeX;
			const newY = this._popup.nativeElement.offsetTop + changeY;

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
					this._view.updateChunks();
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
					this._view.updateChunks();
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
					this._view.updateChunks();
					break;
				case 'bottom-right':
					if (!this.collision_bottom(newY, changeY)) {
						this.renderer2.setStyle(this._popup.nativeElement, 'height', this._popup.nativeElement.offsetHeight + changeY + 'px');
					}
					if (!this.collision_right(newX, changeX)) {
						this.renderer2.setStyle(this._popup.nativeElement, 'width', this._popup.nativeElement.offsetWidth + changeX + 'px');
					}
					this._pixiRenderer.resize(this._pixiCanvasContainer.nativeElement.offsetWidth, this._pixiCanvasContainer.nativeElement.offsetHeight);
					this._view.updateChunks();
					break;
				case 'top':
					if (!this.collision_top(newY, changeY)) {
						this.renderer2.setStyle(this._popup.nativeElement, 'top', newY + 'px');
						this.renderer2.setStyle(this._popup.nativeElement, 'height', this._popup.nativeElement.offsetHeight - changeY + 'px');
						this._pixiRenderer.resize(this._pixiCanvasContainer.nativeElement.offsetWidth, this._pixiCanvasContainer.nativeElement.offsetHeight);
						this._view.updateChunks();
					}
					break;
				case 'right':
					if (!this.collision_right(newX, changeX)) {
						this.renderer2.setStyle(this._popup.nativeElement, 'width', this._popup.nativeElement.offsetWidth + changeX + 'px');
						this._pixiRenderer.resize(this._pixiCanvasContainer.nativeElement.offsetWidth, this._pixiCanvasContainer.nativeElement.offsetHeight);
						this._view.updateChunks();
					}
					break;
				case 'bottom':
					if (!this.collision_bottom(newY, changeY)) {
						this.renderer2.setStyle(this._popup.nativeElement, 'height', this._popup.nativeElement.offsetHeight + changeY + 'px');
						this._pixiRenderer.resize(this._pixiCanvasContainer.nativeElement.offsetWidth, this._pixiCanvasContainer.nativeElement.offsetHeight);
						this._view.updateChunks();
					}
					break;
				case 'left':
					if (!this.collision_left(newX, changeX)) {
						this.renderer2.setStyle(this._popup.nativeElement, 'left', newX + 'px');
						this.renderer2.setStyle(this._popup.nativeElement, 'width', this._popup.nativeElement.offsetWidth - changeX + 'px');
						this._pixiRenderer.resize(this._pixiCanvasContainer.nativeElement.offsetWidth, this._pixiCanvasContainer.nativeElement.offsetHeight);
						this._view.updateChunks();
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

	private mouseDown(event: MouseEvent) {
		if (event.button !== 0)
			return;

		const b = WindowWorkAreaComponent.getBoarderCollision(event.layerX, event.layerY, this._popup.nativeElement);
		if (b) {
			this._currentlyDragging = b;
			this._draggingPos = [ event.screenX, event.screenY ];
		} else if (event.target === this._header.nativeElement) {
			this._currentlyDragging = 'move';
			this._draggingPos = [ event.screenX, event.screenY ];
		}
	}

	private mouseUp(event: MouseEvent) {
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
		this._view.updateChunks();
	}

	ngOnDestroy(): void {
		super.destroy();
	}

}
