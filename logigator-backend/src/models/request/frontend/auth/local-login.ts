import {IsString} from 'class-validator';
import {Required} from '../../../../validators/required.validator';


export class LocalLogin{

	@IsString()
	@Required()
	email: string;

	@IsString()
	@Required()
	password: string;

}
