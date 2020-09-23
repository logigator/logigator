import {IsString} from 'class-validator';
import {Required} from '../../../../validators/required.validator';


export class LocalLogin{

	@IsString()
	@Required()
	username: string;

	@IsString()
	@Required()
	password: string;

}
