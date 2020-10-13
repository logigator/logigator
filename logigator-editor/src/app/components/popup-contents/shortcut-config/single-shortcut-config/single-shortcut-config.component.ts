import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	ElementRef,
	Input,
	NgZone,
	OnDestroy,
	OnInit,
	ViewChild
} from '@angular/core';
import {ShortcutsService} from '../../../../services/shortcuts/shortcuts.service';
import {ShortcutAction, ShortcutConfig} from '../../../../models/shortcut-map';
import {fromEvent, Subject, Subscription} from 'rxjs';
import {takeUntil} from 'rxjs/operators';

@Component({
	selector: 'app-single-shortcut-config',
	templateUrl: './single-shortcut-config.component.html',
	styleUrls: ['./single-shortcut-config.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SingleShortcutConfigComponent implements OnInit, OnDestroy {

	@Input()
	public shortcut: ShortcutAction;

	@ViewChild('inputContainer', {static: true})
	private inputContainer: ElementRef<HTMLElement>;

	public shortcutText: string;
	public isRecording = false;
	private _newShortcutConfig: ShortcutConfig;

	private _destroySubject = new Subject();

	constructor(private shortcuts: ShortcutsService, private ngZone: NgZone, private cdr: ChangeDetectorRef) { }

	ngOnInit() {
		this.shortcutText = this.shortcuts.getShortcutTextForAction(this.shortcut);
		this.ngZone.runOutsideAngular(() => {
			fromEvent(window, 'click').pipe(
				takeUntil(this._destroySubject)
			).subscribe(e => this.onWindowClick(e as MouseEvent));
			fromEvent(this.inputContainer.nativeElement, 'keydown').pipe(
				takeUntil(this._destroySubject)
			).subscribe(e => this.onKeyDown(e as KeyboardEvent));
		});
	}

	public onWindowClick(e: MouseEvent) {
		if (!this.inputContainer.nativeElement.contains(e.target as Node)) {
			this.isRecording = false;
			this.cdr.detectChanges();
		}
	}

	public saveClick() {
		this.isRecording = false;
	}

	public onKeyDown(e: KeyboardEvent) {
		if (!this.isRecording) return;
		e.preventDefault();
		e.stopPropagation();
		this._newShortcutConfig = this.shortcuts.getShortcutConfigFromEvent(e);
		this.shortcutText = this.shortcuts.getShortcutText(this._newShortcutConfig);
		this.cdr.detectChanges();
	}

	public startRecording() {
		this.isRecording = true;
	}

	public get changedShortcutSettings(): { [key: string]: ShortcutConfig } {
		if (!this._newShortcutConfig) return {};
		const toReturn = {};
		toReturn[this.shortcut] = this._newShortcutConfig;
		return toReturn;
	}

	ngOnDestroy(): void {
		this._destroySubject.next();
		this._destroySubject.unsubscribe();
	}
}
