import { Component, OnInit } from '@angular/core';
import {ShortcutMap} from '../../../models/shortcut-map';
import {ShortcutsService} from '../../../services/shortcuts/shortcuts.service';

@Component({
	selector: 'app-shortcut-config',
	templateUrl: './shortcut-config.component.html',
	styleUrls: ['./shortcut-config.component.scss']
})
export class ShortcutConfigComponent implements OnInit {

	constructor(private shortcuts: ShortcutsService) { }

	ngOnInit() {
	}

	public get shortcutMap(): ShortcutMap {
		return this.shortcuts.shortcutMap;
	}

}
