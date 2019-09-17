import { Pipe, PipeTransform } from '@angular/core';
import {ShortcutsService} from '../../services/shortcuts/shortcuts.service';
import {ShortcutAction} from '../../models/shortcut-map';

@Pipe({
	name: 'shortcutText'
})
export class ShortcutTextPipe implements PipeTransform {

	constructor(private shortcuts: ShortcutsService) {}

	transform(value: ShortcutAction): string {
		return this.shortcuts.getShortcutText(value);
	}

}
