import {fromEvent, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';


export class InputManager {

	private _htmlContainer: HTMLElement;

	private _destroySubject = new Subject<any>();

	constructor(htmlContainer: HTMLElement) {
		this._htmlContainer = htmlContainer;
		this.addListeners();
	}

	private addListeners() {
		fromEvent(this._htmlContainer, 'mousemove').pipe(
			takeUntil(this._destroySubject)
		).subscribe((e: MouseEvent) => this.mouseMove(e));

		fromEvent(this._htmlContainer, 'mouseup').pipe(
			takeUntil(this._destroySubject)
		).subscribe((e: MouseEvent) => this.mouseUp(e));

		fromEvent(this._htmlContainer, 'mousedown').pipe(
			takeUntil(this._destroySubject)
		).subscribe((e: MouseEvent) => this.mouseDown(e));

		fromEvent(this._htmlContainer, 'mousewheel').pipe(
			takeUntil(this._destroySubject)
		).subscribe((e: WheelEvent) => this.mouseWheel(e));
	}

	private mouseDown(event: MouseEvent) {
		if (event.button !== 2) return;
		event.preventDefault();
	}

	private mouseUp(event: MouseEvent) {
		if (event.button !== 2) return;
		event.preventDefault();

	}

	private mouseMove(event: MouseEvent) {
		if (event.button !== 2) return;
		event.preventDefault();

	}

	private mouseWheel(event: WheelEvent) {
		event.preventDefault();
	}

	public destroy() {
		this._destroySubject.next();
		this._destroySubject.unsubscribe();
	}

}
