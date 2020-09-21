import {IsIn, IsString} from 'class-validator';

export class SetTheme {

	@IsString()
	@IsIn(['dark', 'light'])
	theme: string;

}
