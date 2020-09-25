import {IsNotEmpty, IsString} from 'class-validator';

export class SetLanguage {

	@IsString()
	@IsNotEmpty()
	lang: string;

}
