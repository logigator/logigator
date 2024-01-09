import { filter, fromEvent, Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NgZone } from '@angular/core';
import { getStaticDI } from '../../utils/get-di';
import { Point } from 'pixi.js';

export const enum ZoomDirection {
	IN,
	OUT
}

export class ViewInputManager {
	private _destroySubject: Subject<void>;
	private _htmlContainer: HTMLElement;

	private _panStart = new Subject<void>();
	private _panEnd = new Subject<void>();
	private _zoom = new Subject<ZoomDirection>();
	private _pan = new Subject<Point>();

	private _mouseDown = false;
	private _mouseMoved = false;

	private _mouseX = 0;
	private _mouseY = 0;
	private _mouseDX = 0;
	private _mouseDY = 0;

	constructor(htmlContainer: HTMLElement, destroySubject: Subject<void>) {
		this._htmlContainer = htmlContainer;
		this._destroySubject = destroySubject;
		this.addListeners();
	}

	private addListeners() {
		getStaticDI(NgZone).runOutsideAngular(() => {
			fromEvent(this._htmlContainer, 'mousemove')
				.pipe(takeUntil(this._destroySubject))
				.subscribe((e: Event) => this.mouseMoveHandler(e as MouseEvent));

			fromEvent(window, 'mouseup')
				.pipe(takeUntil(this._destroySubject))
				.subscribe(() => this.mouseUpHandler());

			fromEvent(this._htmlContainer, 'contextmenu')
				.pipe(takeUntil(this._destroySubject))
				.subscribe((e: Event) => e.preventDefault());

			fromEvent(window, 'contextmenu')
				.pipe(
					takeUntil(this._destroySubject),
					filter(() => this._mouseMoved)
				)
				.subscribe((e: Event) => e.preventDefault());

			fromEvent(this._htmlContainer, 'mousedown')
				.pipe(takeUntil(this._destroySubject))
				.subscribe((e: Event) => this.mouseDownHandler(e as MouseEvent));

			fromEvent(this._htmlContainer, 'wheel', { passive: true })
				.pipe(takeUntil(this._destroySubject))
				.subscribe((e: Event) => this.mouseWheelHandler(e as WheelEvent));
		});
	}

	private mouseDownHandler(event: MouseEvent) {
		if (event.button !== 2) return;
		event.preventDefault();
		this._mouseDown = true;
		this._panStart.next();
	}

	private mouseUpHandler() {
		this._mouseDown = false;
		this._panEnd.next();
		setTimeout(() => (this._mouseMoved = false), 1);
		this.clearMouseDelta();
	}

	private mouseMoveHandler(event: MouseEvent) {
		event.preventDefault();

		const _mouseX = event.offsetX;
		const _mouseY = event.offsetY;

		if (this._mouseDown) {
			this._mouseMoved = true;
			this._pan.next(new Point(_mouseX - this._mouseX, _mouseY - this._mouseY));
			this._mouseDX += _mouseX - this._mouseX;
			this._mouseDY += _mouseY - this._mouseY;
		}

		this._mouseX = _mouseX;
		this._mouseY = _mouseY;
	}

	private mouseWheelHandler(event: WheelEvent) {
		this._zoom.next(event.deltaY < 0 ? ZoomDirection.IN : ZoomDirection.OUT);
	}

	public clearMouseDelta() {
		this._mouseDX = 0;
		this._mouseDY = 0;
	}

	public get interactionStart$(): Observable<void> {
		return this._panStart.asObservable();
	}

	public get interactionEnd$(): Observable<void> {
		return this._panEnd.asObservable();
	}

	public get zoom$(): Observable<ZoomDirection> {
		return this._zoom.asObservable();
	}

	public get pan$(): Observable<Point> {
		return this._pan.asObservable();
	}
}
