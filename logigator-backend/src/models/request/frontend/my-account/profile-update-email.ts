import {IsEmail, IsNotEmpty, IsString} from 'class-validator';


export class ProfileUpdateEmail {

	@IsString()
	@IsNotEmpty()
	@IsEmail()
	email: string;

}
