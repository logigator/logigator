import {IsNotEmpty, IsString, Matches, MinLength} from 'class-validator';
import {MatchesProperty} from '../../../../validators/matches-property.validator';

export class ResetPassword {

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
	token: string;

}
