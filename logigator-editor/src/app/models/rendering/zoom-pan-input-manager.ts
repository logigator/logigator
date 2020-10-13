import {fromEvent, Observable, Subject} from 'rxjs';
import {filter, takeUntil} from 'rxjs/operators';
import {getStaticDI} from '../get-di';
import {NgZone} from '@angular/core';

export class ZoomPanInputManager {

	private _htmlContainer: HTMLElement;

	private _destroySubject = new Subject<any>();
	private _interactionStart = new Subject<void>();
	private _interactionEnd = new Subject<void>();
	private _zoom = new Subject<void>();

	private _mouseDown = false;
	private _mouseMoved = false;

	private _mouseX = 0;
	private _mouseY = 0;
	private _mouseDX = 0;
	private _mouseDY = 0;
	private _wheelUp: boolean;
	private _wheelDown: boolean;

	constructor(htmlContainer: HTMLElement) {
		this._htmlContainer = htmlContainer;
		this.addListeners();
	}

	private addListeners() {
		getStaticDI(NgZone).runOutsideAngular(() => {
			fromEvent(this._htmlContainer, 'mousemove').pipe(
				takeUntil(this._destroySubject)
			).subscribe((e: MouseEvent) => this.mouseMoveHandler(e));

			fromEvent(window, 'mouseup').pipe(
				takeUntil(this._destroySubject)
			).subscribe((e: MouseEvent) => this.mouseUpHandler(e));

			fromEvent(window, 'contextmenu').pipe(
				takeUntil(this._destroySubject),
				filter(() => this._mouseMoved)
			).subscribe((e: MouseEvent) => e.preventDefault());

			fromEvent(this._htmlContainer, 'mousedown').pipe(
				takeUntil(this._destroySubject)
			).subscribe((e: MouseEvent) => this.mouseDownHandler(e));

			fromEvent(this._htmlContainer, 'wheel', {passive: true}).pipe(
				takeUntil(this._destroySubject)
			).subscribe((e: WheelEvent) => this.mouseWheelHandler(e));
		});
	}

	private mouseDownHandler(event: MouseEvent) {
		if (event.button !== 2) return;
		event.preventDefault();
		this._mouseDown = true;
		this._interactionStart.next();
	}

	private mouseUpHandler(event: MouseEvent) {
		this._mouseDown = false;
		this._interactionEnd.next();
		setTimeout(() => this._mouseMoved = false, 1);
		this.clearMouseDelta();
	}

	private mouseMoveHandler(event: MouseEvent) {
		event.preventDefault();

		const _mouseX = event.offsetX;
		const _mouseY = event.offsetY;

		if (this._mouseDown) {
			this._mouseMoved = true;
			this._mouseDX += _mouseX - this._mouseX;
			this._mouseDY += _mouseY - this._mouseY;
		}

		this._mouseX = _mouseX;
		this._mouseY = _mouseY;
	}

	private mouseWheelHandler(event: WheelEvent) {
		if (event.deltaY < 0) {
			this._wheelDown = true;
		} else if (event.deltaY > 0) {
			this._wheelUp = true;
		}
		this._zoom.next();
	}

	public clearMouseDelta() {
		this._mouseDX = 0;
		this._mouseDY = 0;
	}

	public get isMouseDown(): boolean {
		return this._mouseDown;
	}

	public get mouseMoved(): boolean {
		return this._mouseDown && this._mouseMoved;
	}

	public get isDragging(): boolean {
		return this._mouseDown;
	}

	public get mouseDX(): number {
		return this._mouseDX;
	}

	public get mouseDY(): number {
		return this._mouseDY;
	}

	public get mouseX(): number {
		return this._mouseX;
	}

	public get mouseY(): number {
		return this._mouseY;
	}

	public get isZoomIn(): boolean {
		const toReturn = this._wheelUp;
		this._wheelUp = false;
		return toReturn;
	}

	public get isZoomOut(): boolean {
		const toReturn = this._wheelDown;
		this._wheelDown = false;
		return toReturn;
	}

	public get interactionStart$(): Observable<void> {
		return this._interactionStart.asObservable();
	}

	public get interactionEnd$(): Observable<void> {
		return this._interactionEnd.asObservable();
	}

	public get zoom$(): Observable<void> {
		return this._zoom.asObservable();
	}

	public destroy() {
		this._destroySubject.next();
		this._destroySubject.unsubscribe();
	}

}
