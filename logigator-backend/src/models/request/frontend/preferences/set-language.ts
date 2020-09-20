import {IsIn, IsString} from 'class-validator';

export class SetLanguage {

	@IsString()
	submittedFrom: string;

	@IsString()
	@IsIn(['de', 'en'])
	lang: string;

}
