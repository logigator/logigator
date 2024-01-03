import { Pipe, PipeTransform } from '@angular/core';
import { ShortcutAction } from '../../models/shortcut-action';

@Pipe({
	name: 'shortcutText'
})
export class ShortcutTextPipe implements PipeTransform {
	constructor() {}

	transform(value: ShortcutAction): string {
		// return this.shortcutsService.getShortcutTextForAction(value);
		return value;
	}
}
