import {IsIn, IsString} from 'class-validator';

export class SetLanguage {

	@IsString()
	@IsIn(['de', 'en'])
	lang: string;

}
