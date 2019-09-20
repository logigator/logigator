import {Component, EventEmitter, OnInit, Output, QueryList, ViewChildren} from '@angular/core';
import {ShortcutMap} from '../../../models/shortcut-map';
import {ShortcutsService} from '../../../services/shortcuts/shortcuts.service';
import {SingleShortcutConfigComponent} from '../single-shortcut-config/single-shortcut-config.component';

@Component({
	selector: 'app-shortcut-config',
	templateUrl: './shortcut-config.component.html',
	styleUrls: ['./shortcut-config.component.scss']
})
export class ShortcutConfigComponent implements OnInit {

	@Output()
	requestClose: EventEmitter<void> = new EventEmitter<void>();

	@ViewChildren(SingleShortcutConfigComponent)
	singleConfigs: QueryList<SingleShortcutConfigComponent>;

	constructor(private shortcuts: ShortcutsService) { }

	ngOnInit() {
	}

	public get shortcutMap(): ShortcutMap {
		return this.shortcuts.shortcutMap;
	}

	public save() {
		let changedConfig = {};
		this.singleConfigs.forEach(conf => {
			const singleConf = conf.changedShortcutSettings;
			if (singleConf) {
				changedConfig = {
					...changedConfig,
					...singleConf
				};
			}
		});
		this.shortcuts.setShortcutConfig(changedConfig);
		this.requestClose.emit();
	}

}
