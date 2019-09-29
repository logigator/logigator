import {
	Component, ComponentFactory,
	ElementRef,
	EventEmitter,
	HostListener,
	Input,
	OnInit,
	Output,
	TemplateRef,
	ViewChild, ViewContainerRef
} from '@angular/core';
import {PopupContentComp} from '../popup-contents/popup-content-comp';

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
	public contentComp: ComponentFactory<PopupContentComp>;

	@Input()
	public closeOnClickOutside: boolean;

	@ViewChild('contentComponentInsert', {read: ViewContainerRef, static: true})
	private _viewContRef: ViewContainerRef;

	@ViewChild('outsidePopup', {static: true})
	private outsidePopup: ElementRef<HTMLElement>;

	@HostListener('document:keydown.escape')
	public onKeyDown() {
		this.closeClick();
	}

	constructor() { }

	ngOnInit() {
		const contentComp = this._viewContRef.createComponent(this.contentComp);
		const subscription = contentComp.instance.requestClose.subscribe(() => {
			subscription.unsubscribe();
			this.requestClose.emit();
		});
	}

	public closeOutside(event: MouseEvent) {
		if (event.target === this.outsidePopup.nativeElement && this.closeOnClickOutside)
			this.requestClose.emit();
	}

	public closeClick() {
		this.requestClose.emit();
	}
}
