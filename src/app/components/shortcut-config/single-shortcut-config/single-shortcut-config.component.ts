import {ChangeDetectorRef, Component, ElementRef, HostListener, Input, OnInit, ViewChild} from '@angular/core';
import {ShortcutsService} from '../../../services/shortcuts/shortcuts.service';
import {ShortcutAction, ShortcutConfig} from '../../../models/shortcut-map';

@Component({
	selector: 'app-single-shortcut-config',
	templateUrl: './single-shortcut-config.component.html',
	styleUrls: ['./single-shortcut-config.component.scss']
})
export class SingleShortcutConfigComponent implements OnInit {

	@Input()
	public shortcut: ShortcutAction;

	@ViewChild('inputContainer', {static: true})
	private inputContainer: ElementRef<HTMLElement>;

	public shortcutText: string;
	public isRecording = false;
	private _newShortcutConfig: ShortcutConfig;

	constructor(private shortcuts: ShortcutsService) { }

	ngOnInit() {
		this.shortcutText = this.shortcuts.getShortcutTextForAction(this.shortcut);
	}

	@HostListener('window:click', ['$event'])
	public onWindowClick(e: MouseEvent) {
		if (!this.inputContainer.nativeElement.contains(e.target as Node)) {
			this.isRecording = false;
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
	}

	public get shortcutDescription(): string {
		return this.shortcuts.getShortcutDescription(this.shortcut);
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

}
