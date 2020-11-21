import {IsNotEmpty, IsString, MaxLength, MinLength} from 'class-validator';


export class ProfileUpdateUsername {

	@IsString()
	@IsNotEmpty()
	@MinLength(2)
	@MaxLength(20)
	username: string;

}
