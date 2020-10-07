import {IsNotEmpty, IsString, Matches, MaxLength, MinLength} from 'class-validator';


export class ProfileUpdateUsername {

	@IsString()
	@IsNotEmpty()
	@MinLength(2)
	@MaxLength(20)
	@Matches(/^[a-zA-Z0-9_-]+$/)
	username: string;

}
