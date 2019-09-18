import {
	Component,
	ElementRef,
	EventEmitter,
	HostListener,
	Input,
	OnInit,
	Output,
	TemplateRef,
	ViewChild
} from '@angular/core';

@Component({
	selector: 'app-popup',
	templateUrl: './popup.component.html',
	styleUrls: ['./popup.component.scss']
})
export class PopupComponent implements OnInit {

	@Output()
	public requestClose: EventEmitter<any> = new EventEmitter();

	@Input()
	public title: string;

	@Input()
	public content ?: TemplateRef<any>;

	@Input()
	public closeOnClickOutside ? = true;

	@ViewChild('outsideRef', {static: true})
	private elementRef: ElementRef<HTMLElement>;

	@HostListener('document:keydown.escape')
	private onKeyDown() {
		this.closeInside();
	}

	constructor() { }

	ngOnInit() {
	}

	public closeOutside(event: MouseEvent) {
		if (event.target === this.elementRef.nativeElement && this.closeOnClickOutside)
			this.requestClose.emit();
	}

	public closeInside() {
		this.requestClose.emit();
	}
}
