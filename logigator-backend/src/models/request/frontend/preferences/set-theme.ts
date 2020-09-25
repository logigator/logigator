import {IsOptional, IsString} from 'class-validator';

export class SetTheme {

	@IsOptional()
	@IsString()
	dark_mode: string;

}
