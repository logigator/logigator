import {fromEvent, Observable, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {NgZone, Renderer2} from '@angular/core';
import {SimulationView} from '../../models/rendering/simulation-view';
import * as PIXI from 'pixi.js';
import {getStaticDI} from '../../models/get-di';

type Border = 'move' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'right' | 'left' | 'top' | 'bottom';

export class WindowDragManager {

	private _destroySubject = new Subject<any>();

	private _currentlyDragging: Border;
	private _draggingPos = [0, 0];
	private _changeSubject = new Subject<void>();

	private readonly _dragBounding: HTMLElement;
	private readonly _canvasContainer: HTMLElement;
	private readonly _popup: HTMLElement;
	private readonly _header: HTMLElement;

	private readonly renderer2: Renderer2;

	private readonly _minSize: PIXI.Point;
	private readonly _maxSize: PIXI.Point;

	constructor(
		dragBounding: HTMLElement,
		canvasContainer: HTMLElement,
		popup: HTMLElement,
		header: HTMLElement,
		renderer2: Renderer2,
		minSize: PIXI.Point = new PIXI.Point(100, header.offsetHeight + 100),
		maxSize: PIXI.Point = new PIXI.Point(Infinity, Infinity)
	) {
		this._dragBounding = dragBounding;
		this._canvasContainer = canvasContainer;
		this._popup = popup;
		this._header = header;
		this.renderer2 = renderer2;
		this._minSize = minSize;
		this._maxSize = maxSize;

		getStaticDI(NgZone).runOutsideAngular(() => {
			fromEvent(window, 'mousemove').pipe(
				takeUntil(this._destroySubject)
			).subscribe((e: MouseEvent) => this.mouseMove(e));

			fromEvent(window, 'mouseup').pipe(
				takeUntil(this._destroySubject)
			).subscribe(() => this.mouseUp());

			fromEvent(this._popup, 'mousedown').pipe(
				takeUntil(this._destroySubject)
			).subscribe((e: MouseEvent) => this.mouseDown(e));

			fromEvent(this._popup, 'mousemove').pipe(
				takeUntil(this._destroySubject)
			).subscribe((e: MouseEvent) => this.pointerOver(e));

			fromEvent(window, 'resize').pipe(
				takeUntil(this._destroySubject)
			).subscribe((e: MouseEvent) => {
				if (this.collision_right(this._popup.offsetLeft)) {
					let newLoc = (this._dragBounding.offsetLeft + this._dragBounding.offsetWidth) - this._popup.offsetWidth;
					if (this.collision_left(newLoc))
						newLoc = this._dragBounding.offsetLeft;
					this.renderer2.setStyle(this._popup, 'left', newLoc + 'px');
				}
				if (this.collision_bottom(this._popup.offsetTop)) {
					let newLoc = (this._dragBounding.offsetTop + this._dragBounding.offsetHeight) - this._popup.offsetHeight;
					if (this.collision_top(newLoc))
						newLoc = this._dragBounding.offsetTop;
					this.renderer2.setStyle(this._popup, 'top', newLoc + 'px');
				}
			});
		});
	}


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

	private pointerOver(event: MouseEvent) {
		if (this._currentlyDragging)
			return;

		if (event.target === this._header) {
			this.renderer2.setStyle(this._popup, 'cursor', 'move');
			return;
		}

		switch (WindowDragManager.getBoarderCollision(event.offsetX, event.offsetY, this._popup)) {
			case 'top':
				this.renderer2.setStyle(this._popup, 'cursor', 'n-resize');
				break;
			case 'right':
				this.renderer2.setStyle(this._popup, 'cursor', 'e-resize');
				break;
			case 'bottom':
				this.renderer2.setStyle(this._popup, 'cursor', 's-resize');
				break;
			case 'left':
				this.renderer2.setStyle(this._popup, 'cursor', 'w-resize');
				break;
			case 'bottom-left':
				this.renderer2.setStyle(this._popup, 'cursor', 'sw-resize');
				break;
			case 'bottom-right':
				this.renderer2.setStyle(this._popup, 'cursor', 'se-resize');
				this._popup.style.cursor = 'se-resize';
				break;
			case 'top-left':
				this.renderer2.setStyle(this._popup, 'cursor', 'nw-resize');
				break;
			case 'top-right':
				this.renderer2.setStyle(this._popup, 'cursor', 'ne-resize');
				break;
		}
	}

	private mouseMove(event: MouseEvent) {
		if (this._currentlyDragging) {
			const changeX = event.screenX - this._draggingPos[0];
			const changeY = event.screenY - this._draggingPos[1];
			this._draggingPos = [ event.screenX, event.screenY ];

			const newX = this._popup.offsetLeft + changeX;
			const newY = this._popup.offsetTop + changeY;

			switch (this._currentlyDragging) {
				case 'move':
					if (!this.collision_left(newX) && !this.collision_right(newX))
						this.renderer2.setStyle(this._popup, 'left', newX + 'px');
					if (!this.collision_bottom(newY) && !this.collision_top(newY))
						this.renderer2.setStyle(this._popup, 'top', newY + 'px');
					break;
				case 'top-left':
					if (!this.collision_top(newY, changeY)) {
						this.renderer2.setStyle(this._popup, 'top', newY + 'px');
						this.renderer2.setStyle(this._popup, 'height', this._popup.offsetHeight - changeY + 'px');
					}
					if (!this.collision_left(newX, changeX)) {
						this.renderer2.setStyle(this._popup, 'left', newX + 'px');
						this.renderer2.setStyle(this._popup, 'width', this._popup.offsetWidth - changeX + 'px');
					}
					this._changeSubject.next();
					break;
				case 'top-right':
					if (!this.collision_top(newY, changeY)) {
						this.renderer2.setStyle(this._popup, 'top', newY + 'px');
						this.renderer2.setStyle(this._popup, 'height', this._popup.offsetHeight - changeY + 'px');
					}
					if (!this.collision_right(newX, changeX)) {
						this.renderer2.setStyle(this._popup, 'width', this._popup.offsetWidth + changeX + 'px');
					}
					this._changeSubject.next();
					break;
				case 'bottom-left':
					if (!this.collision_bottom(newY, changeY)) {
						this.renderer2.setStyle(this._popup, 'height', this._popup.offsetHeight + changeY + 'px');
					}
					if (!this.collision_left(newX, changeX)) {
						this.renderer2.setStyle(this._popup, 'left', newX + 'px');
						this.renderer2.setStyle(this._popup, 'width', this._popup.offsetWidth - changeX + 'px');
					}
					this._changeSubject.next();
					break;
				case 'bottom-right':
					if (!this.collision_bottom(newY, changeY)) {
						this.renderer2.setStyle(this._popup, 'height', this._popup.offsetHeight + changeY + 'px');
					}
					if (!this.collision_right(newX, changeX)) {
						this.renderer2.setStyle(this._popup, 'width', this._popup.offsetWidth + changeX + 'px');
					}
					this._changeSubject.next();
					break;
				case 'top':
					if (!this.collision_top(newY, changeY)) {
						this.renderer2.setStyle(this._popup, 'top', newY + 'px');
						this.renderer2.setStyle(this._popup, 'height', this._popup.offsetHeight - changeY + 'px');
						this._changeSubject.next();
					}
					break;
				case 'right':
					if (!this.collision_right(newX, changeX)) {
						this.renderer2.setStyle(this._popup, 'width', this._popup.offsetWidth + changeX + 'px');
						this._changeSubject.next();
					}
					break;
				case 'bottom':
					if (!this.collision_bottom(newY, changeY)) {
						this.renderer2.setStyle(this._popup, 'height', this._popup.offsetHeight + changeY + 'px');
						this._changeSubject.next();
					}
					break;
				case 'left':
					if (!this.collision_left(newX, changeX)) {
						this.renderer2.setStyle(this._popup, 'left', newX + 'px');
						this.renderer2.setStyle(this._popup, 'width', this._popup.offsetWidth - changeX + 'px');
						this._changeSubject.next();
					}
					break;
			}
		}
	}

	private collision_left(newX: number, changeX?: number): boolean {
		return newX <= this._dragBounding.offsetLeft
			|| (changeX && (this._popup.offsetWidth - changeX < this._minSize.x || this._popup.offsetWidth - changeX > this._maxSize.x));
	}

	private collision_right(newX: number, changeX?: number): boolean {
		return newX + this._popup.offsetWidth >= this._dragBounding.offsetLeft + this._dragBounding.offsetWidth
			|| (changeX && (this._popup.offsetWidth + changeX < this._minSize.x || this._popup.offsetWidth + changeX > this._maxSize.x));
	}

	private collision_top(newY: number, changeY?: number): boolean {
		return newY <= this._dragBounding.offsetTop
			|| (changeY && (this._popup.offsetHeight - changeY < this._minSize.y || this._popup.offsetHeight - changeY > this._maxSize.y));
	}

	private collision_bottom(newY: number, changeY?: number): boolean {
		return newY + this._popup.offsetHeight >= this._dragBounding.offsetTop + this._dragBounding.offsetHeight
			|| (changeY && (this._popup.offsetHeight + changeY < this._minSize.y || this._popup.offsetHeight + changeY > this._maxSize.y));
	}

	private mouseDown(event: MouseEvent) {
		if (event.button !== 0)
			return;

		const b = WindowDragManager.getBoarderCollision(event.offsetX, event.offsetY, this._popup);
		if (b) {
			this._currentlyDragging = b;
			this._draggingPos = [ event.screenX, event.screenY ];
		} else if (event.target === this._header) {
			this._currentlyDragging = 'move';
			this._draggingPos = [ event.screenX, event.screenY ];
		}
	}

	public get onChange$(): Observable<void> {
		return this._changeSubject.asObservable().pipe(
			takeUntil(this._destroySubject)
		);
	}

	private mouseUp() {
		this._currentlyDragging = undefined;
	}

	public destroy() {
		this._destroySubject.next();
		this._destroySubject.unsubscribe();
	}
}
