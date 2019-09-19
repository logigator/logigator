import {Component, HostListener, Input, OnInit} from '@angular/core';
import {ShortcutsService} from '../../../services/shortcuts/shortcuts.service';
import {ShortcutAction} from '../../../models/shortcut-map';

@Component({
	selector: 'app-single-shortcut-config',
	templateUrl: './single-shortcut-config.component.html',
	styleUrls: ['./single-shortcut-config.component.scss']
})
export class SingleShortcutConfigComponent implements OnInit {

	@Input()
	public shortcut: ShortcutAction;

	public shortcutText: string;
	public isRecording = false;

	constructor(private shortcuts: ShortcutsService) { }

	ngOnInit() {
		this.shortcutText = this.shortcuts.getShortcutText(this.shortcut);
	}

	@HostListener('window:click', ['$event'])
	private onWindowClick(e: MouseEvent) {

	}

	public get shortcutDescription(): string {
		return this.shortcuts.getShortcutDescription(this.shortcut);
	}

	public startRecording() {
		this.isRecording = true;
	}

}
