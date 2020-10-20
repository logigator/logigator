import {ChangeDetectionStrategy, Component, OnInit, QueryList, ViewChildren} from '@angular/core';
import {SingleShortcutConfigComponent} from '../single-shortcut-config/single-shortcut-config.component';
import {PopupContentComp} from '../../../popup/popup-content-comp';
import {EditorActionsService} from '../../../../services/editor-actions/editor-actions.service';
import {EditorActionConfig} from '../../../../models/editor-action-config';

@Component({
	selector: 'app-shortcut-config',
	templateUrl: './shortcut-config.component.html',
	styleUrls: ['./shortcut-config.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShortcutConfigComponent extends PopupContentComp implements OnInit {

	@ViewChildren(SingleShortcutConfigComponent)
	singleConfigs: QueryList<SingleShortcutConfigComponent>;

	constructor(private actionsService: EditorActionsService) {
		super();
	}

	ngOnInit() {
	}

	public get actions(): EditorActionConfig[] {
		return this.actionsService.actionConfig;
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
		this.actionsService.setShortcutConfig(changedConfig);
		this.requestClose.emit();
	}

}
