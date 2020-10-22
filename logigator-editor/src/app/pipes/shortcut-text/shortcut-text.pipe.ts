import { Pipe, PipeTransform } from '@angular/core';
import {ShortcutsService} from '../../services/shortcuts/shortcuts.service';
import {ShortcutAction} from '../../models/shortcut-action';

@Pipe({
	name: 'shortcutText'
})
export class ShortcutTextPipe implements PipeTransform {

	constructor(private shortcutsService: ShortcutsService) {}

	transform(value: ShortcutAction): string {
		return this.shortcutsService.getShortcutTextForAction(value);
	}

}
