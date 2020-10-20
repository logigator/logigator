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
import {fromEvent, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {EditorAction} from '../../../../models/editor-action';
import {ShortcutConfig} from '../../../../models/shortcut-config';
import {EditorActionsService} from '../../../../services/editor-actions/editor-actions.service';

@Component({
	selector: 'app-single-shortcut-config',
	templateUrl: './single-shortcut-config.component.html',
	styleUrls: ['./single-shortcut-config.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SingleShortcutConfigComponent implements OnInit, OnDestroy {

	@Input()
	public shortcut: EditorAction;

	@ViewChild('inputContainer', {static: true})
	private inputContainer: ElementRef<HTMLElement>;

	public shortcutText: string;
	public isRecording = false;
	private _newShortcutConfig: ShortcutConfig;

	private _destroySubject = new Subject();

	constructor(private actions: EditorActionsService, private ngZone: NgZone, private cdr: ChangeDetectorRef) { }

	ngOnInit() {
		this.shortcutText = this.actions.getShortcutTextForAction(this.shortcut);
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
		this._newShortcutConfig = this.actions.getShortcutConfigFromKeyEvent(e);
		this.shortcutText = this.actions.getShortcutText(this._newShortcutConfig);
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
