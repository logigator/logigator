import {IsBoolean, IsNotEmpty, IsString} from 'class-validator';
import {Shortcut as ShortcutEntity} from '../../../../database/entities/shortcut.entity';

export class Shortcut {
	@IsString()
	@IsNotEmpty()
	name: string;

	@IsString()
	@IsNotEmpty()
	keyCode: string;

	@IsBoolean()
	shift: boolean;

	@IsBoolean()
	ctrl: boolean;

	@IsBoolean()
	alt: boolean;

	public toEntity(): ShortcutEntity {
		const shortcut = new ShortcutEntity();
		shortcut.name = this.name;
		shortcut.keyCode = this.keyCode;
		shortcut.ctrl = this.ctrl;
		shortcut.alt = this.alt;
		shortcut.shift = this.shift;
		return shortcut;
	}
}
