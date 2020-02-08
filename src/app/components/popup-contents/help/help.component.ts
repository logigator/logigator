import {
	AfterViewInit,
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	ElementRef,
	OnDestroy,
	ViewChild
} from '@angular/core';
import {PopupContentComp} from '@logigator/logigator-shared-comps';
import {TranslateService} from '@ngx-translate/core';
import {fromEvent, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';

@Component({
	selector: 'app-help',
	templateUrl: './help.component.html',
	styleUrls: ['./help.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelpComponent extends PopupContentComp implements AfterViewInit, OnDestroy {

	@ViewChild('sidebar', {static: true})
	private _sidebar: ElementRef<HTMLDivElement>;

	private _destroySubject = new Subject();

	public helpToRender = 'get-started';

	constructor(private translate: TranslateService, private cdr: ChangeDetectorRef) {
		super();
	}

	public get currentLang(): string {
		return this.translate.currentLang;
	}

	ngAfterViewInit() {
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

	private setActiveClass(link: HTMLElement) {
		this._sidebar.nativeElement.querySelectorAll('p').forEach(p => p.classList.remove('active'));
		link.classList.add('active');
	}

	public get githubEditUrl(): string {
		return `https://github.com/logigator/logigator-editor/tree/development/src/help/${this.currentLang}/${this.helpToRender}.md`;
	}

	ngOnDestroy(): void {
		this._destroySubject.next();
		this._destroySubject.complete();
	}

}
