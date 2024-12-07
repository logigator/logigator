import {IsEmail, IsNotEmpty, IsString} from 'class-validator';

export class LocalLogin {

	@IsString()
	@IsEmail()
	@IsNotEmpty()
	email: string;

	@IsString()
	@IsNotEmpty()
	password: string;

}
