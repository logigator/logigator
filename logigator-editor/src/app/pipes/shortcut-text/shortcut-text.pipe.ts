import { Pipe, PipeTransform } from '@angular/core';
import {EditorActionsService} from '../../services/editor-actions/editor-actions.service';

@Pipe({
	name: 'shortcutText'
})
export class ShortcutTextPipe implements PipeTransform {

	constructor(private actionsService: EditorActionsService) {}

	transform(value: string): string {
		return this.actionsService.getShortcutTextForActionByStringName(value);
	}

}
