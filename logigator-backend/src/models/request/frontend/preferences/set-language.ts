import {IsString} from 'class-validator';
import {Required} from '../../../../validators/required.validator';

export class SetLanguage {

	@IsString()
	@Required()
	lang: string;

}
