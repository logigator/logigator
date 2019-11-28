import {
	ChangeDetectionStrategy,
	Component,
	ComponentFactory,
	ElementRef,
	EventEmitter,
	HostListener,
	Input,
	OnInit,
	Output,
	ViewChild,
	ViewContainerRef
} from '@angular/core';
import {PopupContentComp} from '../popup-contents/popup-content-comp';
import {ThemingService} from '../../../services/theming/theming.service';

@Component({
	selector: 'app-popup',
	templateUrl: './popup.component.html',
	styleUrls: ['./popup.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PopupComponent implements OnInit {

	@Output()
	public requestClose: EventEmitter<any> = new EventEmitter();

	@Input()
	public title: string;

	@Input()
	public titleTranslationParams: { [key: string]: string};

	@Input()
	public contentComp: ComponentFactory<PopupContentComp>;

	@Input()
	public contentCompInput: any;

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

	constructor(private theming: ThemingService) { }

	ngOnInit() {
		const contentComp = this._viewContRef.createComponent(this.contentComp);
		contentComp.instance.inputFromOpener = this.contentCompInput;
		const subscription = contentComp.instance.requestClose.subscribe(output => {
			subscription.unsubscribe();
			this.requestClose.emit(output);
		});
	}

	public closeOutside(event: MouseEvent) {
		if (event.target === this.outsidePopup.nativeElement && this.closeOnClickOutside)
			this.requestClose.emit();
	}

	public closeClick() {
		this.requestClose.emit();
	}

	public get currentTheme() {
		return this.theming.currentTheme;
	}
}
