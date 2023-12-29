import {
	ChangeDetectionStrategy,
	Component,
	OnInit,
	QueryList,
	ViewChildren
} from '@angular/core';
import { SingleShortcutConfigComponent } from '../single-shortcut-config/single-shortcut-config.component';
import { PopupContentComp } from '../../../popup/popup-content-comp';
import { ShortcutsService } from '../../../../services/shortcuts/shortcuts.service';
import { Shortcut } from '../../../../models/shortcut';
import { ShortcutAction } from '../../../../models/shortcut-action';
import { ShortcutConfig } from '../../../../models/shortcut-config';

@Component({
	selector: 'app-shortcut-config',
	templateUrl: './shortcut-config.component.html',
	styleUrls: ['./shortcut-config.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShortcutConfigComponent
	extends PopupContentComp
	implements OnInit
{
	@ViewChildren(SingleShortcutConfigComponent)
	singleConfigs: QueryList<SingleShortcutConfigComponent>;

	constructor(private actionsService: ShortcutsService) {
		super();
	}

	ngOnInit() {}

	public get shortcuts(): Shortcut[] {
		return this.actionsService.shortcutActionConfig;
	}

	public save() {
		const changedConfig = new Map<ShortcutAction, ShortcutConfig>();
		this.singleConfigs.forEach((conf) => {
			const singleConf = conf.changedShortcutSettings;
			if (singleConf) {
				changedConfig.set(singleConf.key, singleConf.config);
			}
		});
		this.actionsService.setShortcutConfig(changedConfig);
		this.requestClose.emit();
	}
}
