import {fromEvent, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';


export class InputManager {

	private _htmlContainer: HTMLElement;

	private _destroySubject = new Subject<any>();

	private _mouseDown = false;
	private _mouseMoved = false;

	private _mouseX = 0;
	private _mouseY = 0;
	private _mouseDX = 0;
	private _mouseDY = 0;

	constructor(htmlContainer: HTMLElement) {
		this._htmlContainer = htmlContainer;
		this.addListeners();
	}

	private addListeners() {
		fromEvent(this._htmlContainer, 'mousemove').pipe(
			takeUntil(this._destroySubject)
		).subscribe((e: MouseEvent) => this.mouseMoveHandler(e));

		fromEvent(this._htmlContainer, 'mouseup').pipe(
			takeUntil(this._destroySubject)
		).subscribe((e: MouseEvent) => this.mouseUpHandler(e));
		fromEvent(window, 'mouseup').pipe(
			takeUntil(this._destroySubject)
		).subscribe((e: MouseEvent) => this.mouseUpHandler(e));

		fromEvent(this._htmlContainer, 'mousedown').pipe(
			takeUntil(this._destroySubject)
		).subscribe((e: MouseEvent) => this.mouseDownHandler(e));

		fromEvent(this._htmlContainer, 'mousewheel').pipe(
			takeUntil(this._destroySubject)
		).subscribe((e: WheelEvent) => this.mouseWheelHandler(e));
	}

	private mouseDownHandler(event: MouseEvent) {
		if (event.button !== 2) return;
		event.preventDefault();

		this._mouseDown = true;
	}

	private mouseUpHandler(event: MouseEvent) {
		if (event.button !== 2) return;
		event.preventDefault();

		this._mouseDown = false;
		this._mouseMoved = false;
	}

	private mouseMoveHandler(event: MouseEvent) {
		event.preventDefault();

		this._mouseX = event.pageX - this._htmlContainer.offsetLeft;
		this._mouseY = event.pageY - this._htmlContainer.offsetTop;

		if (this._mouseDown) {
			this._mouseMoved = true;
			this._mouseDX += event.movementX;
			this._mouseDY += event.movementY;
		}
	}

	private mouseWheelHandler(event: WheelEvent) {
		event.preventDefault();
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

	public destroy() {
		this._destroySubject.next();
		this._destroySubject.unsubscribe();
	}

}
