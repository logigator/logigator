// @ts-strict-ignore
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
import { fromEvent, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ShortcutConfig } from '../../../../models/shortcut-config';
import { ShortcutsService } from '../../../../services/shortcuts/shortcuts.service';
import { Shortcut } from '../../../../models/shortcut';
import { ShortcutAction } from '../../../../models/shortcut-action';

@Component({
	selector: 'app-single-shortcut-config',
	templateUrl: './single-shortcut-config.component.html',
	styleUrls: ['./single-shortcut-config.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SingleShortcutConfigComponent implements OnInit, OnDestroy {
	@Input()
	public shortcut: Shortcut;

	@ViewChild('inputContainer', { static: true })
	private inputContainer: ElementRef<HTMLElement>;

	public shortcutText: string;
	public isRecording = false;
	private _newShortcutConfig: ShortcutConfig;

	private _destroySubject = new Subject<void>();

	constructor(
		private actions: ShortcutsService,
		private ngZone: NgZone,
		private cdr: ChangeDetectorRef
	) {}

	ngOnInit() {
		this.shortcutText = this.actions.getShortcutTextForAction(
			this.shortcut.action
		);
		this.ngZone.runOutsideAngular(() => {
			fromEvent(window, 'click')
				.pipe(takeUntil(this._destroySubject))
				.subscribe((e) => this.onWindowClick(e as MouseEvent));
			fromEvent(this.inputContainer.nativeElement, 'keydown')
				.pipe(takeUntil(this._destroySubject))
				.subscribe((e) => this.onKeyDown(e as KeyboardEvent));
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

	public get changedShortcutSettings(): {
		key: ShortcutAction;
		config: ShortcutConfig;
	} | null {
		if (!this._newShortcutConfig) return null;
		return {
			key: this.shortcut.action,
			config: this._newShortcutConfig
		};
	}

	ngOnDestroy(): void {
		this._destroySubject.next();
		this._destroySubject.unsubscribe();
	}
}
