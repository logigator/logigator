import {IsEmail, IsString, Matches, MaxLength, MinLength} from 'class-validator';
import {Required} from '../../../../validators/required.validator';
import {MatchesProperty} from '../../../../validators/matches-property.validator';

export class LocalRegister {

	@IsString()
	@Required()
	@IsEmail()
	email: string

	@IsString()
	@Required()
	@MinLength(2)
	@Matches(/^(?=.*[A-Za-z])(?=.*[0-9]).*$/)
	password: string;

	@IsString()
	@Required()
	@MatchesProperty('password')
	password_repeat: string;

	@IsString()
	@Required()
	@MinLength(2)
	@MaxLength(20)
	@Matches(/^[a-zA-Z0-9_-]+$/)
	username: string;

}
