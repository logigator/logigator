import {
	Container,
	DestroyOptions,
	FederatedPointerEvent,
	FederatedWheelEvent,
	Point
} from 'pixi.js';
import { filter, fromEvent, Subject, takeUntil } from 'rxjs';

export abstract class InteractionContainer extends Container {
	private _destroySubject$ = new Subject<void>();
	private _isDragging = false;
	private _preventContextMenu = false;

	protected _ticker$ = new Subject<'single' | 'on' | 'off'>();

	abstract pan(delta: Point): void;
	abstract zoomIn(center: Point): void;
	abstract zoomOut(center: Point): void;

	protected constructor() {
		super();

		this.eventMode = 'static';

		fromEvent(window, 'contextmenu')
			.pipe(
				takeUntil(this._destroySubject$),
				filter(() => this._preventContextMenu)
			)
			.subscribe((e) => e.preventDefault());

		this.on('rightdown', this._startPan);
		this.on('rightup', this._stopPan);
		this.on('rightupoutside', this._stopPan);
		this.on('wheel', this._onWheel);
	}

	public get ticker$() {
		return this._ticker$.asObservable();
	}

	private _startPan() {
		if (this._isDragging) {
			return;
		}

		this._isDragging = true;
		this._preventContextMenu = true;
		this.on('pointermove', this._onPan);
		this._ticker$.next('on');
	}

	private _stopPan() {
		if (!this._isDragging) {
			return;
		}

		this._isDragging = false;
		this.off('pointermove', this._onPan);
		this._ticker$.next('off');

		setTimeout(() => {
			this._preventContextMenu = false;
		}, 1);
	}

	private _onPan(e: FederatedPointerEvent) {
		this.pan(e.movement);
	}

	private _onWheel(e: FederatedWheelEvent) {
		if (e.deltaY > 0) {
			this.zoomOut(e.screen);
		} else if (e.deltaY < 0) {
			this.zoomIn(e.screen);
		}
		this._ticker$.next('single');
	}

	override destroy(options?: DestroyOptions) {
		this._destroySubject$.next();
		super.destroy(options);
	}
}
