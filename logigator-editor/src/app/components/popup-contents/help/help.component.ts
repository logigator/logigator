import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	ElementRef,
	OnDestroy,
	OnInit,
	Renderer2,
	ViewChild,
	ViewEncapsulation
} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {fromEvent, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {PopupContentComp} from '../../popup/popup-content-comp';

@Component({
	selector: 'app-help',
	templateUrl: './help.component.html',
	styleUrls: ['./help.component.scss'],
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelpComponent extends PopupContentComp implements OnInit, OnDestroy {

	@ViewChild('sidebar', {static: true})
	private _sidebar: ElementRef<HTMLDivElement>;

	private _destroySubject = new Subject<void>();

	public helpToRender = 'get-started';

	constructor(private translate: TranslateService, private cdr: ChangeDetectorRef, private renderer2: Renderer2) {
		super();
	}

	public get currentLang(): string {
		return this.translate.currentLang;
	}

	ngOnInit() {
		this.insertSideBar();
		this._sidebar.nativeElement.querySelectorAll('p').forEach(link => {
			fromEvent(link, 'click').pipe(
				takeUntil(this._destroySubject)
			).subscribe(() => {
				this.helpToRender = link.id;
				this.setActiveClass(link);
				this.cdr.detectChanges();
			});
		});
		this.setActiveClass(this._sidebar.nativeElement.querySelectorAll('p').item(0));
	}

	private insertSideBar() {
		this.renderer2.setProperty(this._sidebar.nativeElement, 'innerHTML', require(`../../../../help/${this.currentLang}/sidebar.md`));
	}

	private setActiveClass(link: HTMLElement) {
		this._sidebar.nativeElement.querySelectorAll('p').forEach(p => p.classList.remove('active'));
		link.classList.add('active');
	}

	public get githubEditUrl(): string {
		return `https://github.com/logigator/logigator/tree/development/logigator-editor/src/help/${this.currentLang}/${this.helpToRender}.md`;
	}

	ngOnDestroy(): void {
		this._destroySubject.next();
		this._destroySubject.complete();
	}

}
