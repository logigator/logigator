import {IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength} from 'class-validator';
import {MatchesProperty} from '../../../../validators/matches-property.validator';

export class LocalRegister {

	@IsString()
	@IsNotEmpty()
	@IsEmail()
	email: string;

	@IsString()
	@IsNotEmpty()
	@MinLength(8)
	@Matches(/^(?=.*[A-Za-z])(?=.*[0-9]).*$/)
	password: string;

	@IsString()
	@IsNotEmpty()
	@MatchesProperty('password')
	password_repeat: string;

	@IsString()
	@IsNotEmpty()
	@MinLength(2)
	@MaxLength(20)
	@Matches(/^[a-zA-Z0-9_-]+$/)
	username: string;

}
