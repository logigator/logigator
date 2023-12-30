import {
	Directive,
	ElementRef,
	EventEmitter,
	Input,
	NgZone,
	OnDestroy,
	OnInit,
	Output
} from '@angular/core';

@Directive({
	selector: '[appOutsideNgZoneEvent]'
})
export class OutsideNgZoneEventDirective implements OnInit, OnDestroy {
	private handler: ($event?: Event) => void;

	@Input()
	event = 'click';

	@Output('appOutsideNgZoneEvent')
	emitter = new EventEmitter<Event>();

	constructor(
		private ngZone: NgZone,
		private elRef: ElementRef
	) {}

	ngOnInit() {
		this.ngZone.runOutsideAngular(() => {
			this.handler = ($event) => this.emitter.emit($event);
			this.elRef.nativeElement.addEventListener(this.event, this.handler);
		});
	}

	ngOnDestroy(): void {
		this.elRef.nativeElement.removeEventListener(this.event, this.handler);
	}
}
