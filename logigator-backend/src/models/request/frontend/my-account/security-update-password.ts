import {IsNotEmpty, IsOptional, IsString, Matches, MinLength} from 'class-validator';
import {MatchesProperty} from '../../../../validators/matches-property.validator';


export class SecurityUpdatePassword {

	@IsOptional()
	@IsString()
	@IsNotEmpty()
	current_password: string;

	@IsString()
	@IsNotEmpty()
	@MinLength(8)
	@Matches(/^(?=.*[A-Za-z])(?=.*[0-9]).*$/)
	password: string;

	@IsString()
	@IsNotEmpty()
	@MatchesProperty('password')
	password_repeat: string;

}
